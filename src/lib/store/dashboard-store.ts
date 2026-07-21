'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

// ==================== Types ====================

export interface DashboardStats {
  activeProjects: number
  pendingTasks: number
  teamMembers: number
  monthlyProgress: number
}

export interface RecentTask {
  id: string
  title: string
  status: string
  priority: string
  due_date?: string
  project_name?: string
  created_at?: string
}

export interface ProjectProgress {
  id: string
  name: string
  progress: number
  color: string
}

export interface Activity {
  id: string
  user_name: string
  action: string
  target: string
  created_at: string
  avatar?: string
}

// ==================== Store ====================

interface DashboardStore {
  stats: DashboardStats | null
  recentTasks: RecentTask[]
  projectProgress: ProjectProgress[]
  activities: Activity[]
  loading: boolean
  error: string | null

  fetchDashboardData: () => Promise<void>
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  recentTasks: [],
  projectProgress: [],
  activities: [],
  loading: false,
  error: null,

  fetchDashboardData: async () => {
    const supabase = createClient()
    set({ loading: true, error: null })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        set({ loading: false })
        return
      }

      // Parallel fetch for all dashboard data
      const [
        statsResult,
        recentTasksResult,
        projectProgressResult,
        taskCreationsResult,
        projectCreationsResult,
      ] = await Promise.allSettled([
        // 1. Stats: projects, tasks (use creator_id for tasks)
        Promise.all([
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('status', 'active'),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('creator_id', user.id).neq('status', 'done'),
          supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).eq('status', 'active'),
        ]),
        // 2. Recent tasks (join with projects) — use creator_id
        supabase
          .from('tasks')
          .select(`
            id, title, status, priority, due_date, created_at,
            project:projects!tasks_project_id_fkey(name)
          `)
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        // 3. Project progress (with task completion rate)
        supabase
          .from('projects')
          .select('id, name, color, status')
          .eq('owner_id', user.id)
          .eq('status', 'active')
          .limit(8),
        // 4. Recent task creations (for activity feed)
        supabase
          .from('tasks')
          .select('id, title, created_at')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        // 5. Recent project creations (for activity feed)
        supabase
          .from('projects')
          .select('id, name, created_at')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      // Process stats
      let stats: DashboardStats = { activeProjects: 0, pendingTasks: 0, teamMembers: 0, monthlyProgress: 0 }
      if (statsResult.status === 'fulfilled') {
        const [projectsRes, tasksRes, membersRes] = statsResult.value
        stats = {
          activeProjects: projectsRes.count ?? 0,
          pendingTasks: tasksRes.count ?? 0,
          teamMembers: membersRes.count ?? 0,
          monthlyProgress: 0, // computed below
        }
      }

      // Process monthly progress from tasks
      try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const { data: monthTasks } = await supabase
          .from('tasks')
          .select('status')
          .eq('creator_id', user.id)
          .gte('created_at', startOfMonth.toISOString())

        if (monthTasks && monthTasks.length > 0) {
          const done = monthTasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length
          stats.monthlyProgress = Math.round((done / monthTasks.length) * 100)
        }
      } catch { /* skip */ }

      // Process recent tasks
      let recentTasks: RecentTask[] = []
      if (recentTasksResult.status === 'fulfilled' && recentTasksResult.value.data) {
        recentTasks = recentTasksResult.value.data.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          due_date: t.due_date,
          project_name: t.project?.name,
          created_at: t.created_at,
        }))
      }

      // Process project progress (compute from tasks table)
      let projectProgress: ProjectProgress[] = []
      if (projectProgressResult.status === 'fulfilled' && projectProgressResult.value.data) {
        const projects = projectProgressResult.value.data
        // Batch fetch task counts per project
        const projectIds = projects.map((p: any) => p.id)
        if (projectIds.length > 0) {
          const { data: allTasks } = await supabase
            .from('tasks')
            .select('id, status, project_id')
            .in('project_id', projectIds)

          if (allTasks) {
            const tasksByProject: Record<string, { total: number; done: number }> = {}
            for (const task of allTasks) {
              if (!task.project_id) continue
              if (!tasksByProject[task.project_id]) {
                tasksByProject[task.project_id] = { total: 0, done: 0 }
              }
              tasksByProject[task.project_id].total++
              if (task.status === 'done' || task.status === 'completed') tasksByProject[task.project_id].done++
            }

            projectProgress = projects.map((p: any) => {
              const tasks = tasksByProject[p.id] || { total: 0, done: 0 }
              const progress = tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0
              return {
                id: p.id,
                name: p.name,
                progress,
                color: p.color || '#6366f1',
              }
            })
          }
        }
      }

      // Process activities
      let activities: Activity[] = []
      const activityItems: Activity[] = []

      if (taskCreationsResult.status === 'fulfilled' && taskCreationsResult.value.data) {
        for (const t of taskCreationsResult.value.data) {
          activityItems.push({
            id: `task-${t.id}`,
            user_name: '我',
            action: '创建了',
            target: t.title,
            created_at: t.created_at,
            avatar: '我',
          })
        }
      }

      if (projectCreationsResult.status === 'fulfilled' && projectCreationsResult.value.data) {
        for (const p of projectCreationsResult.value.data) {
          activityItems.push({
            id: `project-${p.id}`,
            user_name: '我',
            action: '创建了项目',
            target: p.name,
            created_at: p.created_at,
            avatar: '我',
          })
        }
      }

      // Sort by created_at descending and take top 8
      activities = activityItems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8)

      set({ stats, recentTasks, projectProgress, activities, loading: false })
    } catch (e: any) {
      console.error('[fetchDashboardData]', e)
      set({ error: e?.message || '加载失败', loading: false })
    }
  },
}))
