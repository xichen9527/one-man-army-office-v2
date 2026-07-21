'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface AIConversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

interface AIStore {
  conversations: AIConversation[]
  messages: Record<string, AIMessage[]>
  activeConversationId: string | null
  loading: boolean
  streaming: boolean

  // Actions
  fetchConversations: () => Promise<void>
  createConversation: (title?: string) => Promise<string>
  fetchMessages: (conversationId: string) => Promise<void>
  sendMessage: (conversationId: string, content: string, apiConfig: AIModelConfig) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  setActiveConversation: (id: string | null) => void
}

export interface AIModelConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export const useAIStore = create<AIStore>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  loading: false,
  streaming: false,

  fetchConversations: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (error) throw error
      set({ conversations: data || [] })
    } catch (e: any) {
      toast.error('获取对话列表失败')
    } finally {
      set({ loading: false })
    }
  },

  createConversation: async (title?: string) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: title || `新对话 ${new Date().toLocaleString('zh-CN')}`,
          feature_type: 'chat',
        })
        .select()
        .single()

      if (error) throw error

      set(state => ({
        conversations: [data, ...state.conversations],
        activeConversationId: data.id,
        messages: { ...state.messages, [data.id]: [] }
      }))

      return data.id
    } catch (e: any) {
      toast.error('创建对话失败')
      throw e
    }
  },

  fetchMessages: async (conversationId: string) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error

      set(state => ({
        messages: { ...state.messages, [conversationId]: data || [] }
      }))
    } catch (e: any) {
      toast.error('获取消息失败')
    }
  },

  sendMessage: async (conversationId: string, content: string, apiConfig: AIModelConfig) => {
    const supabase = createClient()
    const userMessage: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    }

    // Add user message immediately
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), userMessage]
      },
      streaming: true
    }))

    // DB save failure should not block the AI response
    let dbUserMsgSaved = false
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save user message to DB (non-blocking, degrade gracefully)
      try {
        const { data: savedMsg, error: msgErr } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'user',
            content
          })
          .select()
          .single()

        if (!msgErr && savedMsg) {
          dbUserMsgSaved = true
          // Update user message with real ID
          set(state => ({
            messages: {
              ...state.messages,
              [conversationId]: state.messages[conversationId].map(m =>
                m.id === userMessage.id ? savedMsg : m
              )
            }
          }))
        }
      } catch {
        // DB save failed, continue with local message
      }

      // Build context messages from current state
      const contextMessages = (get().messages[conversationId] || [])
        .filter(m => m.content && m.role)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const assistantId = `temp-assistant-${Date.now()}`

      // Add placeholder assistant message
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: [...state.messages[conversationId], {
            id: assistantId,
            role: 'assistant' as const,
            content: '',
            created_at: new Date().toISOString()
          }]
        }
      }))

      let assistantContent = ''
      let usedStream = false

      // Try streaming first
      try {
        const response = await fetch(apiConfig.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: apiConfig.model || 'gpt-4',
            messages: contextMessages,
            stream: true
          }),
        })

        if (!response.ok) {
          const errBody = await response.text().catch(() => '')
          throw new Error(`API ${response.status}: ${errBody || response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') continue
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                // Support both delta.content (streaming) and message.content (non-streaming in SSE wrapper)
                const text = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
                if (text) {
                  assistantContent += text
                  set(state => ({
                    messages: {
                      ...state.messages,
                      [conversationId]: state.messages[conversationId].map(m =>
                        m.id === assistantId ? { ...m, content: assistantContent } : m
                      )
                    }
                  }))
                }
              } catch { /* ignore parse errors on partial data */ }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim() && buffer.trim().startsWith('data: ')) {
          try {
            const parsed = JSON.parse(buffer.trim().slice(6))
            const text = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
            if (text) {
              assistantContent += text
              set(state => ({
                messages: {
                  ...state.messages,
                  [conversationId]: state.messages[conversationId].map(m =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  )
                }
              }))
            }
          } catch { /* ignore */ }
        }

        usedStream = true
      } catch (streamErr: any) {
        // Streaming failed, try non-streaming as fallback
        console.warn('Streaming failed, trying non-streaming:', streamErr.message)
      }

      // Fallback: non-streaming request
      if (!usedStream || !assistantContent) {
        try {
          const response = await fetch(apiConfig.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify({
              model: apiConfig.model || 'gpt-4',
              messages: contextMessages,
              stream: false
            }),
          })

          if (!response.ok) {
            const errBody = await response.text().catch(() => '')
            throw new Error(`API ${response.status}: ${errBody || response.statusText}`)
          }

          const json = await response.json()
          assistantContent = json.choices?.[0]?.message?.content || ''

          if (assistantContent) {
            set(state => ({
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId].map(m =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              }
            }))
          }
        } catch (nonStreamErr: any) {
          // Both streaming and non-streaming failed
          if (!assistantContent) {
            const errMsg = nonStreamErr.message || 'AI 服务不可用'
            set(state => ({
              messages: {
                ...state.messages,
                [conversationId]: state.messages[conversationId].map(m =>
                  m.id === assistantId ? { ...m, content: `⚠️ ${errMsg}。请检查 API 配置。` } : m
                )
              }
            }))
            toast.error(errMsg)
          }
        }
      }

      // Save assistant message to DB (non-blocking)
      if (assistantContent) {
        try {
          const { error: saveErr } = await supabase
            .from('ai_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: assistantContent
            })
          if (saveErr) console.error('Failed to save assistant message:', saveErr)
        } catch { /* ignore DB errors */ }

        // Update conversation updated_at
        try {
          await supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
        } catch { /* ignore */ }
      }

    } catch (e: any) {
      // Top-level error (auth, etc.)
      const errorMsg = e.message || 'AI 服务暂时不可用'
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: [...state.messages[conversationId], {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${errorMsg}。请检查 AI API 配置是否正确。`,
            created_at: new Date().toISOString()
          }]
        }
      }))
      toast.error(errorMsg)
    } finally {
      set({ streaming: false })
    }
  },

  deleteConversation: async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.from('ai_conversations').delete().eq('id', id)
      await supabase.from('ai_messages').delete().eq('conversation_id', id)
      set(state => {
        const { [id]: _, ...rest } = state.messages
        return {
          conversations: state.conversations.filter(c => c.id !== id),
          messages: rest,
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
        }
      })
      toast.success('对话已删除')
    } catch {
      toast.error('删除失败')
    }
  },

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id })
    if (id) get().fetchMessages(id)
  }
}))
