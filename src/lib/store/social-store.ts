'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface SocialAccount {
  id: string
  user_id: string
  platform: 'weibo' | 'wechat' | 'douyin' | 'xiaohongshu' | 'bilibili' | 'zhihu' | 'kuaishou'
  account_name: string
  account_id: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  is_active: boolean
  created_at: string
  // 旧表额外字段（兼容）
  follower_count?: number
  following_count?: number
  post_count?: number
  check_status?: string
  metadata?: Record<string, unknown>
}

export interface SocialPost {
  id: string
  user_id: string
  account_id: string
  platform: string
  title?: string
  content: string
  media_urls?: string[]
  scheduled_at?: string
  published_at?: string
  post_url?: string
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  created_at: string
}

export interface SocialPostPlatform {
  id: string
  post_id: string
  account_id: string
  platform: string
  published: boolean
  published_at?: string
  post_url?: string
}

export interface TrendingTopic {
  id: string
  platform: string
  topic: string
  heat: number
  category?: string
  trend?: string
  updated_at: string
}

interface SocialStore {
  accounts: SocialAccount[]
  posts: SocialPost[]
  postPlatforms: SocialPostPlatform[]
  trendingTopics: TrendingTopic[]
  loading: boolean

  fetchAccounts: () => Promise<void>
  addAccount: (account: Omit<SocialAccount, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  toggleAccount: (id: string, is_active: boolean) => Promise<void>
  syncAccount: (id: string) => Promise<void>

  fetchPosts: (accountId?: string) => Promise<void>
  fetchPostPlatforms: (postId?: string) => Promise<void>
  addPost: (post: Omit<SocialPost, 'id' | 'user_id' | 'created_at'>) => Promise<string | null>
  updatePost: (id: string, updates: Partial<SocialPost>) => Promise<void>
  deletePost: (id: string) => Promise<void>
  schedulePost: (id: string, scheduledAt: string) => Promise<void>

  fetchTrendingTopics: () => Promise<void>
  refreshTrendingTopics: () => Promise<void>

  initiateOAuth: (accountId: string, platform: string) => Promise<{ auth_url?: string; error?: string }>
  publishPost: (postId: string, accountId: string, content: string, title?: string, platform?: string) => Promise<{ success: boolean; error?: string; post_url?: string }>
}

export const useSocialStore = create<SocialStore>((set, get) => ({
  accounts: [],
  posts: [],
  postPlatforms: [],
  trendingTopics: [],
  loading: false,

  fetchAccounts: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('获取账号列表失败: ' + error.message)
        return
      }
      // Map DB columns to interface (username -> account_name, platform_user_id -> account_id)
      const mapped = (data || []).map((a: any) => ({
        ...a,
        account_name: a.account_name || a.username || '',
        account_id: a.account_id || a.platform_user_id || '',
        is_active: a.is_active ?? true,
      }))
      set({ accounts: mapped })
    } catch (e: any) {
      toast.error('获取账号列表失败')
    } finally {
      set({ loading: false })
    }
  },

  addAccount: async (account) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      // Map interface fields to DB columns (account_name -> username, account_id -> platform_user_id)
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        platform: account.platform,
        username: account.account_name,
        platform_user_id: account.account_id || '',
        access_token: account.access_token || '',
        refresh_token: account.refresh_token || null,
        token_expires_at: account.token_expires_at || null,
        is_active: account.is_active ?? true,
      }

      const { data, error } = await supabase
        .from('social_accounts')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error
      set(state => ({ accounts: [data, ...state.accounts] }))
      toast.success('账号添加成功')
    } catch (e: any) {
      toast.error(e.message || '添加账号失败')
    }
  },

  removeAccount: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.from('social_accounts').delete().eq('id', id)
      set(state => ({ accounts: state.accounts.filter(a => a.id !== id) }))
      toast.success('账号已移除')
    } catch {
      toast.error('移除失败')
    }
  },

  toggleAccount: async (id: string, is_active: boolean) => {
    const supabase = createClient()
    try {
      await supabase.from('social_accounts').update({ is_active }).eq('id', id)
      set(state => ({
        accounts: state.accounts.map(a => a.id === id ? { ...a, is_active } : a)
      }))
    } catch {
      toast.error('更新失败')
    }
  },

  syncAccount: async (id: string) => {
    const supabase = createClient()
    const account = get().accounts.find(a => a.id === id)
    if (!account) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sync-social-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({
          platform: account.platform,
          account_id: id,
          current_followers: account.follower_count,
          current_post_count: account.post_count,
        }),
      })
      const json = await resp.json()
      if (json.success) {
        await supabase.from('social_accounts').update({
          follower_count: json.follower_count,
          following_count: json.following_count,
          post_count: json.post_count,
          check_status: 'active',
        }).eq('id', id)
        toast.success('同步成功')
        await get().fetchAccounts()
      } else {
        toast.error(json.error || '同步失败')
      }
    } catch {
      toast.error('同步失败')
    }
  },

  fetchPosts: async (accountId?: string) => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('social_media_posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (accountId) query = query.eq('account_id', accountId)

      const { data, error } = await query
      if (error) {
        toast.error('获取帖子列表失败: ' + error.message)
        return
      }
      set({ posts: data || [] })
    } catch {
      toast.error('获取帖子列表失败')
    } finally {
      set({ loading: false })
    }
  },

  fetchPostPlatforms: async (postId?: string) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', user.id)

      if (!accounts || accounts.length === 0) {
        set({ postPlatforms: [] })
        return
      }

      const accountIds = accounts.map(a => a.id)
      let query = supabase
        .from('social_post_platforms')
        .select('*')
        .in('account_id', accountIds)

      if (postId) query = query.eq('post_id', postId)

      const { data, error } = await query
      if (error) {
        toast.error('获取发布平台失败: ' + error.message)
        return
      }
      set({ postPlatforms: data || [] })
    } catch {
      toast.error('获取发布平台失败')
    }
  },

  addPost: async (post) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('未登录')

      let accountId = post.account_id
      if (!accountId) {
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
        if (accounts && accounts.length > 0) {
          accountId = accounts[0].id
        }
      }

      // Build insert payload — don't include account_id if empty (FK constraint)
      const insertPayload: Record<string, unknown> = {
        ...post,
        user_id: user.id,
        status: post.status || (post.scheduled_at ? 'scheduled' : 'draft'),
      }
      if (accountId) {
        insertPayload.account_id = accountId
      }

      const { data, error } = await supabase
        .from('social_media_posts')
        .insert(insertPayload)
        .select()
        .single()

      if (error) throw error
      set(state => ({ posts: [data, ...state.posts] }))
      toast.success('帖子已保存')
      return data.id
    } catch (e: any) {
      toast.error(e.message || '保存失败')
      return null
    }
  },

  updatePost: async (id: string, updates: Partial<SocialPost>) => {
    const supabase = createClient()
    try {
      const { error } = await supabase
        .from('social_media_posts')
        .update(updates as Record<string, unknown>)
        .eq('id', id)

      if (error) throw error
      set(state => ({
        posts: state.posts.map(p => p.id === id ? { ...p, ...updates } : p)
      }))
      toast.success('帖子已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deletePost: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.from('social_media_posts').delete().eq('id', id)
      set(state => ({ posts: state.posts.filter(p => p.id !== id) }))
      toast.success('帖子已删除')
    } catch {
      toast.error('删除失败')
    }
  },

  schedulePost: async (id: string, scheduledAt: string) => {
    await get().updatePost(id, {
      scheduled_at: scheduledAt,
      status: 'scheduled'
    })
  },

  fetchTrendingTopics: async () => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('trending_topics')
        .select('*')
        .order('heat', { ascending: false })
        .limit(50)

      if (error) {
        toast.error('获取热门话题失败')
        return
      }
      set({ trendingTopics: data || [] })
    } catch {
      toast.error('获取热门话题失败')
    }
  },

  refreshTrendingTopics: async () => {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

      if (!token) throw new Error('未登录')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-trending-lists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({}),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      await get().fetchTrendingTopics()
      toast.success('热门话题已刷新')
    } catch (e: any) {
      toast.error(e.message || '刷新热门话题失败')
    }
  },

  initiateOAuth: async (accountId: string, platform: string) => {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/social-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ account_id: accountId, platform }),
      })

      const json = await resp.json()
      if (json.needs_credentials) {
        return { error: '请先在平台设置中填写 App Key 和 App Secret，再点击「连接平台」' }
      }
      if (json.error) return { error: json.error }
      return { auth_url: json.auth_url }
    } catch {
      return { error: '网络错误，请重试' }
    }
  },

  publishPost: async (postId, accountId, content, title, platform) => {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/social-publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ post_id: postId, account_id: accountId, content, title, platform }),
      })

      const json = await resp.json()
      if (json.success) {
        await supabase.from('social_media_posts').update({
          status: 'published',
          published_at: new Date().toISOString(),
          post_url: json.post_url || null,
        }).eq('id', postId)
        await get().fetchPosts()
      }
      return json
    } catch {
      return { success: false, error: '网络错误，请重试' }
    }
  },
}))
