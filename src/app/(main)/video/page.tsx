'use client'

import {
  Video,
  Mic,
  Monitor,
  Users,
  Plus,
  Clock,
  Trash2,
  Pencil,
  LogIn,
  Copy,
  Check,
  Loader2,
  Calendar,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  useVideoStore,
  type Conference,
  type ConferenceStatus,
  type LiveKitTokenResult,
} from '@/lib/store/video-store'

const STATUS_LABEL: Record<ConferenceStatus, string> = {
  scheduled: '已预约',
  ongoing: '进行中',
  ended: '已结束',
  cancelled: '已取消',
}

const STATUS_CLASS: Record<ConferenceStatus, string> = {
  scheduled: 'bg-amber-500/10 text-amber-600',
  ongoing: 'bg-red-500/10 text-red-600',
  ended: 'bg-gray-500/10 text-gray-600',
  cancelled: 'bg-gray-500/10 text-gray-500',
}

interface FormState {
  title: string
  description: string
  scheduledAt: string
  duration: number
  max_participants: number
  participants: string
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  scheduledAt: '',
  duration: 60,
  max_participants: 10,
  participants: '',
}

export default function VideoPage() {
  const {
    conferences,
    liveKitConfig,
    loading,
    fetchConferences,
    fetchLiveKitConfig,
    createConference,
    updateConference,
    deleteConference,
    getLiveKitToken,
  } = useVideoStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [joining, setJoining] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<LiveKitTokenResult | null>(null)
  const [joinRoom, setJoinRoom] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchConferences()
    fetchLiveKitConfig()
  }, [fetchConferences, fetchLiveKitConfig])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (conf: Conference) => {
    setEditingId(conf.id)
    setForm({
      title: conf.title,
      description: conf.description || '',
      scheduledAt: conf.scheduled_at ? toLocalInput(conf.scheduled_at) : '',
      duration: conf.duration ?? 60,
      max_participants: conf.max_participants ?? 10,
      participants: (conf.participants || []).join(', '),
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      duration: Number(form.duration) || 60,
      max_participants: Number(form.max_participants) || 10,
      participants: form.participants
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }
    if (editingId) {
      await updateConference(editingId, payload)
    } else {
      await createConference(payload)
    }
    setShowForm(false)
  }

  const handleJoin = async (conf: Conference) => {
    setJoining(true)
    setJoinRoom(conf.meeting_id)
    const res = await getLiveKitToken(conf.meeting_id, 'join')
    setJoining(false)
    if (res) {
      setTokenInfo(res)
    } else {
      setJoinRoom(null)
    }
  }

  const copyToken = async () => {
    if (!tokenInfo) return
    try {
      await navigator.clipboard.writeText(tokenInfo.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">视频会议</h1>
          <p className="text-muted-foreground">创建和管理视频会议</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger
            render={
              <Button className="gap-2 btn-press" onClick={openCreate}>
                <Video className="h-4 w-4" />
                创建会议
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? '编辑会议' : '创建会议'}</DialogTitle>
              <DialogDescription>填写会议信息后保存到数据库</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">会议标题</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：项目评审会议"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">描述（可选）</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="会议议程或备注"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">开始时间</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">时长（分钟）</Label>
                  <Input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">最大人数</Label>
                  <Input
                    type="number"
                    value={form.max_participants}
                    onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">参与者（逗号分隔）</Label>
                  <Input
                    value={form.participants}
                    onChange={(e) => setForm({ ...form, participants: e.target.value })}
                    placeholder="user1, user2"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline">取消</Button>}
              />
              <Button onClick={handleSubmit}>{editingId ? '保存' : '创建'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Start */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          className="card-glow cursor-pointer hover:border-primary/30"
          onClick={openCreate}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">快速会议</p>
              <p className="text-xs text-muted-foreground">立即开始</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glow cursor-pointer hover:border-primary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <Monitor className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">屏幕共享</p>
              <p className="text-xs text-muted-foreground">演示或协作</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-glow cursor-pointer hover:border-primary/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
              <Mic className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-medium">语音会议</p>
              <p className="text-xs text-muted-foreground">仅音频通话</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meeting Rooms */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">会议室</h2>
        {loading && conferences.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : conferences.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              还没有会议，点击右上角「创建会议」开始。
            </CardContent>
          </Card>
        ) : (
          conferences.map((conf) => (
            <Card key={conf.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{conf.title}</p>
                    <Badge
                      variant="secondary"
                      className={STATUS_CLASS[conf.status as ConferenceStatus]}
                    >
                      {STATUS_LABEL[conf.status as ConferenceStatus] || conf.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {conf.participants?.length || 0}人
                    </span>
                    {conf.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(conf.scheduled_at).toLocaleString('zh-CN')}
                      </span>
                    )}
                    {conf.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {conf.duration}分钟
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="btn-press"
                    disabled={joining && joinRoom === conf.meeting_id}
                    onClick={() => handleJoin(conf)}
                  >
                    {joining && joinRoom === conf.meeting_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    加入
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => openEdit(conf)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => deleteConference(conf.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* LiveKit Token Dialog */}
      <Dialog open={!!tokenInfo} onOpenChange={(o) => !o && setTokenInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>会议连接信息</DialogTitle>
            <DialogDescription>
              Token 由 livekit-token Edge Function 生成，可用于加入 LiveKit 房间。
            </DialogDescription>
          </DialogHeader>
          {tokenInfo && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">LiveKit 服务器地址</Label>
                <Input readOnly value={tokenInfo.url} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Access Token</Label>
                <Textarea readOnly value={tokenInfo.token} rows={5} className="font-mono text-xs" />
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={copyToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? '已复制' : '复制 Token'}
              </Button>
              {!liveKitConfig && (
                <p className="text-xs text-muted-foreground">
                  提示：当前未检测到 video_conference_configs 中的 LiveKit 凭证，
                  若获取失败请先在「设置 → 视频会议」配置 server_url / api_key / api_secret。
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline">关闭</Button>}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}
