'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================

export interface Project {
  id: string
  owner_id: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  color?: string
  created_at: string
  updated_at: string
  // Enriched fields (from joins)
  member_count?: number
  task_count?: number
  done_count?: number
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  full_name: string
  email: string
  avatar_url?: string
}

// ==================== Store ====================

interface ProjectStore {
  projects: Project[]
  projectMembers: Record<string, ProjectMember[]>
  loading: boolean
  submitting: boolean

  fetchProjects: () => Promise<void>
  createProject: (data: { name: string; description?: string; color?: string }) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  fetchProjectMembers: (projectId: string) => Promise<void>
  addProjectMember: (projectId: string, email: string, role: ProjectMember['role']) => Promise<void>
  removeProjectMember: (projectId: string, memberId: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  projectMembers: {},
  loading: false,
  submitting: false,

  fetchProjects: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ loading: false }); return }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('获取项目列表失败')
        set({ loading: false })
        return
      }

      // Enrich with task counts
      const projects = (data || []) as Project[]
      const enriched = await Promise.all(
        projects.map(async (p) => {
          try {
            const { count: total } = await supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', p.id)

            const { count: done } = await supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', p.id)
              .eq('status', 'done')

            const { count: members } = await supabase
              .from('project_members')
              .select('id', { count: 'exact', head: true })
              .eq('project_id', p.id)

            return {
              ...p,
              task_count: total ?? 0,
              done_count: done ?? 0,
              member_count: members ?? 0,
            }
          } catch {
            return p
          }
        })
      )

      set({ projects: enriched as Project[], loading: false })
    } catch {
      toast.error('获取项目列表失败')
      set({ loading: false })
    }
  },

  createProject: async (data) => {
    const supabase = createClient()
    set({ submitting: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const { error } = await supabase
        .from('projects')
        .insert({
          name: data.name,
          description: data.description || '',
          color: data.color || '#6366f1',
          status: 'active',
          owner_id: user.id,
        } as Record<string, unknown>)

      if (error) throw error

      toast.success('项目已创建')
      await get().fetchProjects()
    } catch (e: any) {
      toast.error(e.message || '创建失败')
    } finally {
      set({ submitting: false })
    }
  },

  updateProject: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set(state => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...data } : p)
      }))
      toast.success('项目已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteProject: async (id) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error

      set(state => ({
        projects: state.projects.filter(p => p.id !== id)
      }))
      toast.success('项目已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  fetchProjectMembers: async (projectId) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('id, project_id, user_id, role')
        .eq('project_id', projectId)

      if (error) throw error

      const members = data || []
      const userIds = members.map((m: any) => m.user_id).filter(Boolean)

      let profiles: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', userIds)

        if (profileData) {
          profileData.forEach((p: any) => { profiles[p.id] = p })
        }
      }

      const enriched: ProjectMember[] = members.map((m: any) => ({
        ...m,
        full_name: profiles[m.user_id]?.full_name || profiles[m.user_id]?.username || m.user_id?.slice(0, 8) || '成员',
        email: profiles[m.user_id]?.email || '',
        avatar_url: profiles[m.user_id]?.avatar_url,
      }))

      set(state => ({
        projectMembers: { ...state.projectMembers, [projectId]: enriched }
      }))
    } catch (e: any) {
      toast.error('获取成员失败: ' + (e.message || ''))
    }
  },

  addProjectMember: async (projectId, email, role) => {
    const supabase = createClient()
    try {
      // Find user by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (!profile) throw new Error('未找到该邮箱对应的用户')

      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: projectId,
          user_id: profile.id,
          role: role || 'member',
        } as Record<string, unknown>)

      if (error) throw error

      toast.success('成员已添加')
      await get().fetchProjectMembers(projectId)
    } catch (e: any) {
      toast.error(e.message || '添加失败')
    }
  },

  removeProjectMember: async (projectId, memberId) => {
    const supabase = createClient()
    try {
      await supabase.from('project_members').delete().eq('id', memberId)

      set(state => ({
        projectMembers: {
          ...state.projectMembers,
          [projectId]: (state.projectMembers[projectId] || []).filter(m => m.id !== memberId)
        }
      }))
      toast.success('成员已移除')
    } catch (e: any) {
      toast.error(e.message || '移除失败')
    }
  },
}))
