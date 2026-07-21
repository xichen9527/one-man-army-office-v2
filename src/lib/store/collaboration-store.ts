'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ==================== Types ====================
export interface Channel {
  id: string
  name: string
  description?: string
  is_private: boolean
  created_by: string
  created_at: string
}

export interface Message {
  id: string
  channel_id: string
  sender_id: string
  sender_name?: string
  content: string
  message_type?: 'text' | 'file' | 'image' | 'system'
  file_url?: string
  file_name?: string
  reply_to?: string | null
  is_edited?: boolean  // computed locally, not a DB column
  created_at: string
  updated_at?: string
  // joined from profile
  profile?: {
    full_name?: string
    username?: string
    avatar_url?: string
  }
}

export interface Profile {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string
}

export interface ChannelMember {
  id: string
  channel_id: string
  user_id: string
  role: string
  full_name?: string
  username?: string
  email?: string
  avatar_url?: string
  joined_at: string
}

// ==================== Store ====================
interface CollaborationStore {
  channels: Channel[]
  messages: Record<string, Message[]>
  activeChannelId: string | null
  onlineMembers: Profile[]
  channelMembers: Record<string, ChannelMember[]>
  loading: boolean

  setActiveChannel: (id: string | null) => void

  fetchChannels: () => Promise<void>
  createChannel: (name: string, description?: string, isPrivate?: boolean) => Promise<void>
  updateChannel: (id: string, updates: Partial<Channel>) => Promise<void>
  deleteChannel: (id: string) => Promise<void>

  fetchMessages: (channelId: string) => Promise<void>
  sendMessage: (channelId: string, content: string) => Promise<void>
  sendFileMessage: (channelId: string, fileUrl: string, fileName: string) => Promise<void>
  updateMessage: (id: string, channelId: string, content: string) => Promise<void>
  deleteMessage: (id: string, channelId: string) => Promise<void>

  // Channel members / invitations
  fetchChannelMembers: (channelId: string) => Promise<void>
  inviteUser: (channelId: string, email: string, role?: string) => Promise<void>
  removeMember: (channelId: string, memberId: string) => Promise<void>

  // Realtime subscriptions
  _realtimeChannels: Record<string, RealtimeChannel>
  subscribeToMessages: (channelId: string) => void
  unsubscribeFromChannel: (channelId: string) => void
  unsubscribeAll: () => void
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  channels: [],
  messages: {},
  activeChannelId: null,
  onlineMembers: [],
  channelMembers: {},
  loading: false,
  _realtimeChannels: {},

  setActiveChannel: (id) => {
    const prev = get().activeChannelId
    set({ activeChannelId: id })
    if (prev) get().unsubscribeFromChannel(prev)
    if (id) {
      get().fetchMessages(id)
      get().subscribeToMessages(id)
      get().fetchChannelMembers(id)
    }
  },

  fetchChannels: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ loading: false }); return }

      // private channels created by user
      const { data: privateChannels } = await supabase
        .from('channels')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_private', true)

      // public channels
      const { data: publicChannels } = await supabase
        .from('channels')
        .select('*')
        .eq('is_private', false)

      const merged = [
        ...(privateChannels || []),
        ...((publicChannels || []).filter(
          (p: Channel) => !(privateChannels || []).some((c: Channel) => c.id === p.id)
        )),
      ]

      set({ channels: merged as Channel[] })

      // auto-select first channel
      if (merged.length > 0 && !get().activeChannelId) {
        get().setActiveChannel(merged[0].id)
      }
    } catch {
      toast.error('获取频道失败')
    } finally {
      set({ loading: false })
    }
  },

  createChannel: async (name, description, isPrivate = false) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      const { data, error } = await supabase
        .from('channels')
        .insert({
          name,
          description: description || '',
          is_private: isPrivate,
          created_by: user.id,
        } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      set(state => ({ channels: [...state.channels, data as Channel] }))
      toast.success('频道已创建')
    } catch (e: any) {
      toast.error(e.message || '创建失败')
    }
  },

  updateChannel: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('channels')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        channels: state.channels.map(c => c.id === id ? { ...c, ...data } : c)
      }))
      toast.success('频道已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteChannel: async (id) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('channels').delete().eq('id', id)
      if (error) throw error

      set(state => {
        const newMessages = { ...state.messages }
        delete newMessages[id]
        const remaining = state.channels.filter(c => c.id !== id)
        return {
          channels: remaining,
          messages: newMessages,
          activeChannelId: state.activeChannelId === id ? (remaining[0]?.id || null) : state.activeChannelId,
        }
      })
      toast.success('频道已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  fetchMessages: async (channelId) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profile:profiles(id, full_name, username, avatar_url)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200)

      if (error) {
        // Fallback without profile join
        const { data: data2, error: error2 } = await supabase
          .from('messages')
          .select('*')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true })
          .limit(200)

        if (error2) { toast.error('获取消息失败'); return }
        set(state => ({
          messages: { ...state.messages, [channelId]: (data2 || []) as Message[] }
        }))
        return
      }

      set(state => ({
        messages: { ...state.messages, [channelId]: (data || []) as Message[] }
      }))
    } catch {
      toast.error('获取消息失败')
    }
  },

  sendMessage: async (channelId, content) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      // get sender name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single()

      const senderName = profile?.full_name || profile?.username || '未知用户'

      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          sender_name: senderName,
          content,
          message_type: 'text',
          reply_to: null,
        } as Record<string, unknown>)
        .select('*, profile:profiles(id, full_name, username, avatar_url)')
        .single()

      if (error) {
        // Fallback: insert without profile join
        const { data: data2, error: error2 } = await supabase
          .from('messages')
          .insert({
            channel_id: channelId,
            sender_id: user.id,
            sender_name: senderName,
            content,
            message_type: 'text',
            reply_to: null,
          } as Record<string, unknown>)
          .select()
          .single()

        if (error2) throw error2

        set(state => ({
          messages: {
            ...state.messages,
            [channelId]: [...(state.messages[channelId] || []), data2 as Message]
          }
        }))
        return
      }

      set(state => ({
        messages: {
          ...state.messages,
          [channelId]: [...(state.messages[channelId] || []), data as Message]
        }
      }))
    } catch (e: any) {
      toast.error(e.message || '发送失败')
      throw e
    }
  },

  sendFileMessage: async (channelId, fileUrl, fileName) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single()

      const senderName = profile?.full_name || profile?.username || '未知用户'
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)

      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          sender_name: senderName,
          content: fileName,
          message_type: isImage ? 'image' : 'file',
          file_url: fileUrl,
          file_name: fileName,
          reply_to: null,
        } as Record<string, unknown>)
        .select('*, profile:profiles(id, full_name, username, avatar_url)')
        .single()

      if (error) throw error

      set(state => ({
        messages: {
          ...state.messages,
          [channelId]: [...(state.messages[channelId] || []), data as Message]
        }
      }))
    } catch (e: any) {
      toast.error(e.message || '发送失败')
      throw e
    }
  },

  updateMessage: async (id, channelId, content) => {
    const supabase = createClient()
    try {
      // is_edited is not a DB column — only update content
      const { data, error } = await supabase
        .from('messages')
        .update({ content } as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      set(state => ({
        messages: {
          ...state.messages,
          [channelId]: (state.messages[channelId] || []).map(m =>
            m.id === id ? { ...m, ...data, is_edited: true } : m
          )
        }
      }))
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteMessage: async (id, channelId) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id)
      if (error) throw error
      set(state => ({
        messages: {
          ...state.messages,
          [channelId]: (state.messages[channelId] || []).filter(m => m.id !== id)
        }
      }))
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  // ==================== Channel Members ====================

  fetchChannelMembers: async (channelId) => {
    const supabase = createClient()
    try {
      // channel_members table may not exist — use a graceful fallback
      const { data, error } = await supabase
        .from('channel_members')
        .select('id, channel_id, user_id, role, joined_at')
        .eq('channel_id', channelId)

      if (error) {
        // Table might not exist — just set empty members
        set(state => ({
          channelMembers: { ...state.channelMembers, [channelId]: [] }
        }))
        return
      }

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

      const enriched: ChannelMember[] = members.map((m: any) => ({
        ...m,
        full_name: profiles[m.user_id]?.full_name || profiles[m.user_id]?.username || m.user_id?.slice(0, 8) || '成员',
        username: profiles[m.user_id]?.username,
        email: profiles[m.user_id]?.email || '',
        avatar_url: profiles[m.user_id]?.avatar_url,
      }))

      set(state => ({
        channelMembers: { ...state.channelMembers, [channelId]: enriched }
      }))
    } catch {
      // channel_members table doesn't exist — set empty
      set(state => ({
        channelMembers: { ...state.channelMembers, [channelId]: [] }
      }))
    }
  },

  inviteUser: async (channelId, email, role = 'member') => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      // Find user by email in profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('email', email)
        .single()

      if (!profile) {
        toast.error('未找到该邮箱对应的用户')
        return
      }

      // Insert into channel_members (if table exists)
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: profile.id,
          role,
        } as Record<string, unknown>)

      if (error) {
        // Table might not exist — show informative message
        toast.error('邀请失败：频道成员表不存在，请联系管理员创建 channel_members 表')
        return
      }

      toast.success(`已邀请 ${profile.full_name || profile.username || email} 加入频道`)
      await get().fetchChannelMembers(channelId)
    } catch (e: any) {
      toast.error(e.message || '邀请失败')
    }
  },

  removeMember: async (channelId, memberId) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      set(state => ({
        channelMembers: {
          ...state.channelMembers,
          [channelId]: (state.channelMembers[channelId] || []).filter(m => m.id !== memberId)
        }
      }))
      toast.success('成员已移除')
    } catch (e: any) {
      toast.error(e.message || '移除失败')
    }
  },

  // ==================== Realtime ====================

  subscribeToMessages: (channelId) => {
    const supabase = createClient()
    const existing = get()._realtimeChannels[channelId]
    if (existing) return

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // fetch full message with profile join
          try {
            const { data: fullMsg } = await supabase
              .from('messages')
              .select('*, profile:profiles(id, full_name, username, avatar_url)')
              .eq('id', payload.new.id)
              .single()

            const msg = (fullMsg || payload.new) as Message

            set(state => {
              const existing = state.messages[channelId] || []
              // avoid duplicates
              if (existing.some(m => m.id === msg.id)) return state
              return {
                messages: {
                  ...state.messages,
                  [channelId]: [...existing, msg]
                }
              }
            })
          } catch {
            // Use payload directly if join fails
            const msg = payload.new as Message
            set(state => {
              const existing = state.messages[channelId] || []
              if (existing.some(m => m.id === msg.id)) return state
              return {
                messages: {
                  ...state.messages,
                  [channelId]: [...existing, msg]
                }
              }
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          set(state => ({
            messages: {
              ...state.messages,
              [channelId]: (state.messages[channelId] || []).map(m =>
                m.id === payload.new.id ? { ...m, ...payload.new, is_edited: true } : m
              )
            }
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          set(state => ({
            messages: {
              ...state.messages,
              [channelId]: (state.messages[channelId] || []).filter(m => m.id !== payload.old.id)
            }
          }))
        }
      )
      .subscribe()

    set(state => ({
      _realtimeChannels: { ...state._realtimeChannels, [channelId]: channel }
    }))
  },

  unsubscribeFromChannel: (channelId) => {
    const channel = get()._realtimeChannels[channelId]
    if (channel) {
      const supabase = createClient()
      supabase.removeChannel(channel)
      set(state => {
        const next = { ...state._realtimeChannels }
        delete next[channelId]
        return { _realtimeChannels: next }
      })
    }
  },

  unsubscribeAll: () => {
    const supabase = createClient()
    const channels = get()._realtimeChannels
    Object.values(channels).forEach(ch => supabase.removeChannel(ch))
    set({ _realtimeChannels: {} })
  },
}))
