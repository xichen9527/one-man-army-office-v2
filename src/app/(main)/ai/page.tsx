'use client'

import {
  Sparkles,
  Send,
  Loader2,
  User,
  Bot,
  Plus,
  Settings,
  Trash2,
  MessageSquare,
  Check,
  X,
  TestTube2,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAIStore, type AIModelConfig } from '@/lib/store/ai-store'
import { toast } from 'sonner'

interface AIAPIConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  isDefault: boolean
}

const AI_PROVIDERS = [
  { name: 'OpenAI GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: '硅基流动 (免费额度)', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
  { name: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '阿里通义', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.0-flash' },
  { name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514' },
  { name: '智谱 GLM-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: 'Moonshot AI', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '自定义 (Custom)', baseUrl: '', model: '' },
]

const PRESETS = [
  '帮我分析这个项目的进度',
  '生成本周工作周报',
  '优化这段代码',
  '制定项目计划',
  '写一封客户跟进邮件',
]

export default function AIPage() {
  const {
    conversations,
    messages,
    activeConversationId,
    loading,
    streaming,
    fetchConversations,
    createConversation,
    sendMessage,
    deleteConversation,
    setActiveConversation,
  } = useAIStore()

  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : []

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, streaming])

  const getActiveApiConfig = (): AIModelConfig | null => {
    try {
      const configs: AIAPIConfig[] = JSON.parse(localStorage.getItem('ai_api_configs') || '[]')
      const active = configs.find((c) => c.isDefault) || configs[0]
      if (!active || !active.baseUrl || !active.apiKey || !active.model) return null
      return {
        apiUrl: active.baseUrl.replace(/\/$/, '') + '/chat/completions',
        apiKey: active.apiKey,
        model: active.model,
      }
    } catch {
      return null
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming) return

    let convId = activeConversationId
    if (!convId) {
      convId = await createConversation()
    }
    if (!convId) return

    const cfg = getActiveApiConfig()
    if (!cfg) {
      toast.error('请先在「AI 模型设置」中配置 API')
      setShowSettings(true)
      return
    }

    setInput('')
    await sendMessage(convId, text, cfg)
  }

  const handleNewConversation = async () => {
    const id = await createConversation()
    if (id) setActiveConversation(id)
  }

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar: conversation list */}
      <div className="hidden w-64 shrink-0 flex-col rounded-xl border bg-card md:flex">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-sm font-semibold">对话历史</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {loading && conversations.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted-foreground">加载中…</div>
            ) : conversations.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted-foreground">还没有对话，点击 + 新建</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                    c.id === activeConversationId ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => setActiveConversation(c.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{c.title}</span>
                  <button
                    className="hidden opacity-0 transition group-hover:block group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(c.id)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat */}
      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI 助手</h1>
            <p className="text-xs text-muted-foreground">基于大语言模型的智能协作助手</p>
          </div>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="ml-auto gap-2">
                  <Settings className="h-4 w-4" />
                  AI 模型设置
                </Button>
              }
            />
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>AI 模型设置</DialogTitle>
                <DialogDescription>
                  配置兼容 OpenAI 协议的 API（Base URL + API Key + 模型名称）
                </DialogDescription>
              </DialogHeader>
              <AIModelSettingsPanel />
            </DialogContent>
          </Dialog>
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          >
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {streaming ? '生成中' : '在线'}
          </Badge>
        </div>

        <Card className="flex flex-1 overflow-hidden flex-col">
          <ScrollArea className="flex-1 p-4">
            {!activeConversationId ? (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[75%] space-y-1">
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
                      您好！我是您的 AI 协作助手。新建对话后，即可开始提问。下面是一些常用预设：
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-11">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setInput(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeMessages.length === 0 && (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    这是一个新的对话，发送消息开始吧。
                  </div>
                )}
                {activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={
                          msg.role === 'assistant'
                            ? 'bg-primary/10 text-primary text-sm'
                            : 'bg-purple-500/10 text-purple-500 text-sm'
                        }
                      >
                        {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] space-y-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
                      <div
                        className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === 'assistant'
                            ? 'bg-muted rounded-tl-sm'
                            : 'bg-primary text-primary-foreground rounded-tr-sm'
                        }`}
                      >
                        {msg.content}
                        {streaming && msg.role === 'assistant' && msg.content === '' && (
                          <Loader2 className="inline h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t flex gap-2">
            <Input
              placeholder="输入您的问题..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1"
            />
            <Button size="icon" disabled={!input.trim() || streaming} onClick={handleSend}>
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function AIModelSettingsPanel() {
  const [configs, setConfigs] = useState<AIAPIConfig[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ai_api_configs') || '[]')
    } catch {
      return []
    }
  })
  const [selectedProvider, setSelectedProvider] = useState(0)
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  const provider = AI_PROVIDERS[selectedProvider]
  const effectiveBaseUrl =
    selectedProvider === AI_PROVIDERS.length - 1 ? customBaseUrl : provider.baseUrl
  const effectiveModel =
    selectedProvider === AI_PROVIDERS.length - 1 ? customModel : provider.model

  const saveToLs = (next: AIAPIConfig[]) => {
    localStorage.setItem('ai_api_configs', JSON.stringify(next))
    setConfigs(next)
  }

  const handleAdd = () => {
    if (!apiKey || !effectiveBaseUrl || !effectiveModel) {
      toast.error('请填写完整信息（API Key、Base URL、模型名称）')
      return
    }
    if (apiKey.trim().length < 10) {
      toast.error('API Key 格式不正确，请检查是否完整复制')
      return
    }
    const config: AIAPIConfig = {
      id: editingId || `api-${Date.now()}`,
      name: selectedProvider === AI_PROVIDERS.length - 1 ? '自定义' : provider.name,
      baseUrl: effectiveBaseUrl,
      apiKey: apiKey.trim(),
      model: effectiveModel.trim(),
      isDefault: editingId
        ? configs.find((c) => c.id === editingId)?.isDefault || false
        : configs.length === 0,
    }
    const next = [...configs]
    if (editingId) {
      const idx = next.findIndex((c) => c.id === editingId)
      if (idx !== -1) next[idx] = config
    } else {
      next.push(config)
    }
    saveToLs(next)
    resetForm()
    toast.success('配置已保存')
  }

  const handleEdit = (config: AIAPIConfig) => {
    const idx = AI_PROVIDERS.findIndex(
      (p) => p.baseUrl === config.baseUrl && p.model === config.model,
    )
    setSelectedProvider(idx >= 0 ? idx : AI_PROVIDERS.length - 1)
    setApiKey(config.apiKey)
    if (idx === AI_PROVIDERS.length - 1 || idx < 0) {
      setCustomBaseUrl(config.baseUrl)
      setCustomModel(config.model)
    }
    setEditingId(config.id)
  }

  const resetForm = () => {
    setEditingId(null)
    setApiKey('')
    setCustomBaseUrl('')
    setCustomModel('')
    setSelectedProvider(0)
    setTestResult(null)
  }

  const handleDelete = (id: string) => {
    const filtered = configs.filter((c) => c.id !== id)
    if (filtered.length > 0 && !filtered.some((c) => c.isDefault)) filtered[0].isDefault = true
    saveToLs(filtered)
  }

  const handleSetDefault = (id: string) => {
    saveToLs(configs.map((c) => ({ ...c, isDefault: c.id === id })))
  }

  const handleTest = async (config: AIAPIConfig) => {
    setTesting(config.id)
    setTestResult(null)
    try {
      const base = config.baseUrl.replace(/\/$/, '')
      const resp = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      })
      if (resp.ok) {
        setTestResult({ id: config.id, ok: true, msg: '连接成功' })
      } else {
        const err = await resp.json().catch(() => ({}))
        setTestResult({
          id: config.id,
          ok: false,
          msg: err?.error?.message || `HTTP ${resp.status}`,
        })
      }
    } catch (e: any) {
      setTestResult({ id: config.id, ok: false, msg: e.message || '网络错误' })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* List */}
      <div className="space-y-2">
        {configs.length === 0 && (
          <p className="text-xs text-muted-foreground">尚未配置任何模型，请在下方添加。</p>
        )}
        {configs.map((c) => (
          <div key={c.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                {c.isDefault && (
                  <Badge variant="secondary" className="text-[10px]">
                    默认
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTest(c)}>
                  {testing === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <TestTube2 className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{c.baseUrl}</p>
            <p className="text-xs text-muted-foreground">模型：{c.model}</p>
            {!c.isDefault && (
              <button
                className="mt-2 text-xs text-primary hover:underline"
                onClick={() => handleSetDefault(c.id)}
              >
                设为默认
              </button>
            )}
            {testResult?.id === c.id && (
              <p
                className={`mt-2 text-xs ${
                  testResult.ok ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {testResult.ok ? <Check className="mr-1 inline h-3 w-3" /> : <X className="mr-1 inline h-3 w-3" />}
                {testResult.msg}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <p className="text-sm font-medium">{editingId ? '编辑配置' : '新增配置'}</p>
        <div className="space-y-1.5">
          <Label className="text-xs">服务商</Label>
          <Select
            value={String(selectedProvider)}
            onValueChange={(v) => setSelectedProvider(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p, i) => (
                <SelectItem key={p.name} value={String(i)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedProvider === AI_PROVIDERS.length - 1 && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input
                placeholder="https://api.example.com/v1"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">模型名称</Label>
              <Input
                placeholder="gpt-4o"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">API Key</Label>
          <Input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleAdd}>
            {editingId ? '保存修改' : '添加'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              取消
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
