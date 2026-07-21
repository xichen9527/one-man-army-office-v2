'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export type ConferenceStatus = 'scheduled' | 'ongoing' | 'ended' | 'cancelled'

export interface Conference {
  id: string
  meeting_id: string
  meeting_number: string | null
  join_url: string | null
  title: string
  description: string | null
  host_id: string
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  duration: number | null
  status: ConferenceStatus
  max_participants: number
  participants: string[]
  recording_enabled: boolean
  recording_url: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface LiveKitConfig {
  id: string
  user_id: string
  server_url: string
  api_key: string
  api_secret: string
  created_at: string
  updated_at: string
}

export interface LiveKitTokenResult {
  token: string
  url: string
}

export interface CreateConferenceInput {
  title: string
  description?: string | null
  scheduled_at?: string | null
  duration?: number
  max_participants?: number
  participants?: string[]
}

interface VideoStore {
  conferences: Conference[]
  liveKitConfig: LiveKitConfig | null
  loading: boolean

  // Actions
  fetchConferences: () => Promise<void>
  createConference: (data: CreateConferenceInput) => Promise<string | null>
  updateConference: (id: string, updates: Partial<Conference>) => Promise<void>
  deleteConference: (id: string) => Promise<void>
  fetchLiveKitConfig: () => Promise<void>
  getLiveKitToken: (roomName: string, action: 'join' | 'create') => Promise<LiveKitTokenResult | null>
}

export const useVideoStore = create<VideoStore>((set, get) => ({
  conferences: [],
  liveKitConfig: null,
  loading: false,

  fetchConferences: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // RLS policy handles filtering: host or participant can see
      const { data, error } = await supabase
        .from('video_conferences')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ conferences: data || [] })
    } catch (e: any) {
      toast.error('获取会议列表失败')
    } finally {
      set({ loading: false })
    }
  },

  createConference: async (data: CreateConferenceInput) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const meetingId = 'meet-' + crypto.randomUUID().slice(0, 8)

      const { data: inserted, error } = await supabase
        .from('video_conferences')
        .insert({
          title: data.title,
          description: data.description ?? null,
          host_id: user.id,
          meeting_id: meetingId,
          scheduled_at: data.scheduled_at ?? null,
          duration: data.duration ?? 60,
          max_participants: data.max_participants ?? 10,
          participants: data.participants ?? [],
          status: 'scheduled',
          recording_enabled: false,
        })
        .select()
        .single()

      if (error) throw error

      set(state => ({
        conferences: [inserted as Conference, ...state.conferences],
      }))
      toast.success('会议已创建')
      return (inserted as Conference).id
    } catch (e: any) {
      toast.error('创建会议失败')
      return null
    }
  },

  updateConference: async (id: string, updates: Partial<Conference>) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('video_conferences')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        conferences: state.conferences.map(c => c.id === id ? (data as Conference) : c),
      }))
    } catch (e: any) {
      toast.error('更新会议失败')
    }
  },

  deleteConference: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.from('video_conferences').delete().eq('id', id)
      set(state => ({
        conferences: state.conferences.filter(c => c.id !== id),
      }))
      toast.success('会议已删除')
    } catch (e: any) {
      toast.error('删除失败')
    }
  },

  fetchLiveKitConfig: async () => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('video_conference_configs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      set({ liveKitConfig: (data as LiveKitConfig) || null })
    } catch (e: any) {
      // LiveKit config is optional; do not surface errors during listing
      set({ liveKitConfig: null })
    }
  },

  getLiveKitToken: async (roomName: string, action: 'join' | 'create') => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const config = get().liveKitConfig
      const body: Record<string, unknown> = { roomName, action }
      if (config?.server_url && config?.api_key && config?.api_secret) {
        body.serverUrl = config.server_url
        body.apiKey = config.api_key
        body.apiSecret = config.api_secret
      }

      // Call the livekit-token Edge Function (Supabase) to mint a JWT
      const { data, error } = await supabase.functions.invoke('livekit-token', { body })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      return { token: data.token as string, url: data.url as string } as LiveKitTokenResult
    } catch (e: any) {
      toast.error('获取会议 Token 失败：' + (e.message || '未知错误'))
      return null
    }
  },
}))
