'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================

export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  project_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  assignee_id?: string
  creator_id: string
  parent_task_id?: string
  created_at: string
  updated_at: string
  // Enriched
  project_name?: string
  assignee_name?: string
}

export interface TaskFilters {
  project_id?: string
  assignee_id?: string
  status?: TaskStatus
}

// ==================== Store ====================

interface TaskStore {
  tasks: Task[]
  loading: boolean
  submitting: boolean

  fetchTasks: (filters?: TaskFilters) => Promise<void>
  createTask: (data: { title: string; description?: string; project_id?: string; priority?: TaskPriority; due_date?: string }) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  updateTaskStatus: (id: string, newStatus: TaskStatus) => Promise<void>
  fetchSubTasks: (parentTaskId: string) => Promise<Task[]>
}

// Status display mapping
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待处理',
  in_progress: '进行中',
  done: '已完成',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  done: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  submitting: false,

  fetchTasks: async (filters) => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ loading: false }); return }

      let query = supabase
        .from('tasks')
        .select(`
          *,
          project:projects!tasks_project_id_fkey(id, name),
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, username)
        `)
        .or(`creator_id.eq.${user.id},assignee_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id)
      }
      if (filters?.assignee_id) {
        query = query.eq('assignee_id', filters.assignee_id)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) {
        toast.error('获取任务列表失败')
        set({ loading: false })
        return
      }

      const enriched: Task[] = (data || []).map((t: any) => ({
        ...t,
        project_name: t.project?.name,
        assignee_name: t.assignee?.full_name || t.assignee?.username,
      }))

      set({ tasks: enriched as Task[], loading: false })
    } catch {
      toast.error('获取任务列表失败')
      set({ loading: false })
    }
  },

  createTask: async (data) => {
    const supabase = createClient()
    set({ submitting: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || '',
        project_id: data.project_id || null,
        priority: data.priority || 'medium',
        due_date: data.due_date || null,
        status: 'todo' as TaskStatus,
        creator_id: user.id,
      } as Record<string, unknown>)

      if (error) throw error

      toast.success('任务已创建')
      await get().fetchTasks()
    } catch (e: any) {
      toast.error(e.message || '创建失败')
    } finally {
      set({ submitting: false })
    }
  },

  updateTask: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...data } : t)
      }))
      toast.success('任务已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteTask: async (id) => {
    const supabase = createClient()
    try {
      await supabase.from('tasks').delete().eq('id', id)
      set(state => ({
        tasks: state.tasks.filter(t => t.id !== id)
      }))
      toast.success('任务已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  updateTaskStatus: async (id, newStatus) => {
    const supabase = createClient()
    // Optimistic update
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === id ? { ...t, status: newStatus } : t
      )
    }))

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', id)

      if (error) throw error
    } catch (e: any) {
      // Rollback
      await get().fetchTasks()
      toast.error(e.message || '状态更新失败')
    }
  },

  fetchSubTasks: async (parentTaskId) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_task_id', parentTaskId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Task[]
    } catch {
      // parent_task_id column may not exist yet — return empty array
      return []
    }
  },
}))
