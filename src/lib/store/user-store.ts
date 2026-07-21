'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================

export interface Profile {
  id: string
  email: string
  full_name?: string
  username?: string
  avatar_url?: string
  bio?: string
  job_title?: string
  department?: string
  timezone?: string
  email_change_pending?: string
  email_change_token?: string
  email_change_count?: number
  email_change_requested_at?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  content: string
  type: string
  is_read: boolean        // 注意列名是 is_read，不是 read
  created_at: string
}

export interface ApprovalRequest {
  id: string
  requester_id: string
  title: string
  description?: string
  type: 'expense' | 'leave' | 'purchase' | 'other'
  amount?: number
  status: 'pending' | 'approved' | 'rejected'
  approver_id?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  owner_id: string
  user_id: string
  full_name: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  joined_at?: string
  invited_at?: string
}

export interface Invitation {
  id: string
  team_owner_id: string
  email: string
  role: TeamMember['role']
  token: string
  status: 'pending' | 'accepted' | 'expired'
  created_at: string
}

// ==================== Store ====================

interface UserStore {
  // Profile
  profile: Profile | null
  profileLoading: boolean
  fetchProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  changeEmail: (newEmail: string) => Promise<void>

  // Notifications
  notifications: Notification[]
  notificationsLoading: boolean
  fetchNotifications: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>

  // Approvals
  approvals: ApprovalRequest[]
  approvalsLoading: boolean
  fetchApprovals: () => Promise<void>
  createApproval: (data: Omit<ApprovalRequest, 'id' | 'requester_id' | 'created_at' | 'updated_at'>) => Promise<void>
  approveRequest: (id: string) => Promise<void>
  rejectRequest: (id: string) => Promise<void>

  // Team
  members: TeamMember[]
  invitations: Invitation[]
  teamLoading: boolean
  fetchTeamMembers: () => Promise<void>
  fetchInvitations: () => Promise<void>
  addMember: (email: string, role: TeamMember['role']) => Promise<void>
  removeMember: (id: string) => Promise<void>
  updateMember: (id: string, updates: Partial<TeamMember>) => Promise<void>
}

export const useUserStore = create<UserStore>((set, get) => ({
  // ========== Profile ==========
  profile: null,
  profileLoading: false,

  fetchProfile: async () => {
    const supabase = createClient()
    set({ profileLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        toast.error('获取个人资料失败')
        return
      }
      set({ profile: data as Profile })
    } catch {
      toast.error('获取个人资料失败')
    } finally {
      set({ profileLoading: false })
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const { data, error } = await supabase
        .from('profiles')
        .update(updates as Record<string, unknown>)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      set({ profile: data as Profile })
      toast.success('资料已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  changeEmail: async (newEmail: string) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      // 检查 profiles 表的修改次数限制（3次）
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_change_count, email_change_requested_at')
        .eq('id', user.id)
        .single()

      if (profile && (profile.email_change_count ?? 0) >= 3) {
        const requestedAt = new Date(profile.email_change_requested_at)
        const now = new Date()
        const daysSinceRequest = Math.floor((now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceRequest < 30) {
          throw new Error(`邮箱修改已达上限（3次/30天），请 ${30 - daysSinceRequest} 天后重试`)
        }
      }

      // 生成修改令牌
      const token = crypto.randomUUID()
      const requestedAt = new Date().toISOString()

      // 写入 profiles 表（email_change_pending / email_change_token / email_change_count）
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          email_change_pending: newEmail,
          email_change_token: token,
          email_change_requested_at: requestedAt,
          email_change_count: ((profile?.email_change_count) ?? 0) + 1,
        } as Record<string, unknown>)
        .eq('id', user.id)

      if (profileError) throw profileError

      // 调用 Supabase Auth 更新邮箱（需验证）
      const { error: authError } = await supabase.auth.updateUser({ email: newEmail })
      if (authError) throw authError

      toast.success('验证邮件已发送至新邮箱，请点击链接确认')
      await get().fetchProfile()
    } catch (e: any) {
      toast.error(e.message || '邮箱修改失败')
    }
  },

  // ========== Notifications ==========
  notifications: [],
  notificationsLoading: false,

  fetchNotifications: async () => {
    const supabase = createClient()
    set({ notificationsLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('获取通知失败')
        return
      }
      set({ notifications: data || [] })
    } catch {
      toast.error('获取通知失败')
    } finally {
      set({ notificationsLoading: false })
    }
  },

  markNotificationRead: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true } as Record<string, unknown>)
        .eq('id', id)

      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, is_read: true } : n
        )
      }))
    } catch {
      toast.error('标记已读失败')
    }
  },

  markAllNotificationsRead: async () => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('notifications')
        .update({ is_read: true } as Record<string, unknown>)
        .eq('user_id', user.id)
        .eq('is_read', false)

      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true }))
      }))
    } catch {
      toast.error('全部标记已读失败')
    }
  },

  // ========== Approvals ==========
  approvals: [],
  approvalsLoading: false,

  fetchApprovals: async () => {
    const supabase = createClient()
    set({ approvalsLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('获取审批列表失败')
        return
      }
      set({ approvals: data || [] })
    } catch {
      toast.error('获取审批列表失败')
    } finally {
      set({ approvalsLoading: false })
    }
  },

  createApproval: async (data) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const { error } = await supabase
        .from('approvals')
        .insert({ ...data, requester_id: user.id } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      toast.success('审批请求已提交')
      await get().fetchApprovals()
    } catch (e: any) {
      toast.error(e.message || '提交失败')
    }
  },

  approveRequest: async (id: string) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('approvals')
        .update({
          status: 'approved',
          approver_id: user.id,
          resolved_at: now,
          updated_at: now,
        } as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        approvals: state.approvals.map(a => a.id === id ? { ...a, status: 'approved', approver_id: user.id, resolved_at: now } : a)
      }))
      toast.success('已批准')
    } catch (e: any) {
      toast.error(e.message || '批准失败')
    }
  },

  rejectRequest: async (id: string) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('approvals')
        .update({
          status: 'rejected',
          approver_id: user.id,
          resolved_at: now,
          updated_at: now,
        } as Record<string, unknown>)
        .eq('id', id)

      if (error) throw error
      set(state => ({
        approvals: state.approvals.map(a => a.id === id ? { ...a, status: 'rejected', approver_id: user.id, resolved_at: now } : a)
      }))
      toast.success('已拒绝')
    } catch (e: any) {
      toast.error(e.message || '拒绝失败')
    }
  },

  // ========== Team ==========
  members: [],
  invitations: [],
  teamLoading: false,

  fetchTeamMembers: async () => {
    const supabase = createClient()
    set({ teamLoading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, role, status, joined_at, id')
        .eq('owner_id', user.id)

      if (membersError) {
        toast.error('获取团队成员失败')
        set({ teamLoading: false })
        return
      }

      if (!members || members.length === 0) {
        set({ members: [], teamLoading: false })
        return
      }

      const userIds = members.map((m: any) => m.user_id).filter(Boolean)
      let profiles: Record<string, any> = {}

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, username, email')
          .in('id', userIds)

        if (profileData) {
          profileData.forEach((p: any) => { profiles[p.id] = p })
        }
      }

      const enriched: TeamMember[] = members.map((m: any) => ({
        ...m,
        owner_id: user.id,
        full_name: profiles[m.user_id]?.full_name || profiles[m.user_id]?.username || m.user_id?.slice(0, 8) || '成员',
        email: profiles[m.user_id]?.email || '',
        joined_at: m.joined_at || m.invited_at || new Date().toISOString(),
      }))

      set({ members: enriched, teamLoading: false })
    } catch {
      toast.error('获取团队成员失败')
      set({ teamLoading: false })
    }
  },

  fetchInvitations: async () => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('team_owner_id', user.id)

      if (error) {
        toast.error('获取邀请列表失败')
        return
      }
      set({ invitations: data || [] })
    } catch {
      toast.error('获取邀请列表失败')
    }
  },

  addMember: async (email: string, role: TeamMember['role']) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      const token = crypto.randomUUID()
      const { error } = await supabase
        .from('invitations')
        .insert({
          team_owner_id: user.id,
          email,
          role,
          token,
        } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      toast.success('邀请已发送')
      await get().fetchInvitations()
    } catch (e: any) {
      toast.error(e.message || '添加成员失败')
    }
  },

  removeMember: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.from('team_members').delete().eq('id', id)
      set(state => ({ members: state.members.filter(m => m.id !== id) }))
      toast.success('成员已移除')
    } catch {
      toast.error('移除失败')
    }
  },

  updateMember: async (id: string, updates: Partial<TeamMember>) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('team_members')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        members: state.members.map(m => m.id === id ? { ...m, ...data } : m)
      }))
      toast.success('成员已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },
}))
