'use client'
import { useEffect, useState } from "react"
import { Share2, TrendingUp, Clock, Eye, Plus, Trash2, Send, RefreshCw, ExternalLink, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useSocialStore, type SocialAccount, type SocialPost } from "@/lib/store/social-store"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const PLATFORM_CONFIG: Record<string, { name: string; emoji: string; color: string; maxChars: number }> = {
  weibo:         { name: "微博",     emoji: "📱", color: "bg-red-500",   maxChars: 2000 },
  xiaohongshu:  { name: "小红书",  emoji: "📕", color: "bg-pink-500",  maxChars: 1000 },
  douyin:       { name: "抖音",     emoji: "🎵", color: "bg-cyan-500",  maxChars: 500  },
  bilibili:     { name: "B站",     emoji: "📺", color: "bg-pink-600",  maxChars: 500  },
  wechat:       { name: "微信",     emoji: "💬", color: "bg-green-500",  maxChars: 500  },
  zhihu:        { name: "知乎",     emoji: "💭", color: "bg-blue-500",  maxChars: 5000 },
  kuaishou:     { name: "快手",     emoji: "🎬", color: "bg-orange-500",maxChars: 500  },
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  scheduled: "待发布",
  published: "已发布",
  failed: "失败",
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

// ---- Platform Account Card ----
function AccountCard({ account, onRemove, onToggle, onSync }: {
  account: SocialAccount
  onRemove: () => void
  onToggle: (v: boolean) => void
  onSync: () => void
}) {
  const cfg = PLATFORM_CONFIG[account.platform] || { name: account.platform, emoji: "📱", color: "bg-gray-500" }
  return (
    <Card className={cn("transition-all", !account.is_active && "opacity-60")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-white text-lg flex-shrink-0", cfg.color)}>
            {cfg.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{account.account_name || cfg.name}</p>
              <Badge variant="secondary" className="text-xs">{cfg.name}</Badge>
            </div>
            {account.follower_count !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">
                粉丝 {account.follower_count.toLocaleString()} · 帖子 {account.post_count ?? 0}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSync} title="同步数据">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Switch checked={account.is_active} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove} title="移除">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Post Editor Dialog ----
function PostEditor({ open, onOpenChange, accounts, post, onSave, onPublish }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  accounts: SocialAccount[]
  post?: SocialPost | null
  onSave: (data: { content: string; account_id: string; title?: string; scheduled_at?: string }) => Promise<void>
  onPublish?: (data: { content: string; account_id: string; title?: string }) => Promise<void>
}) {
  const [content, setContent] = useState(post?.content || "")
  const [title, setTitle] = useState(post?.title || "")
  const [accountId, setAccountId] = useState(post?.account_id || accounts[0]?.id || "")
  const [scheduledAt, setScheduledAt] = useState(post?.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : "")
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const platform = accounts.find(a => a.id === accountId)?.platform || "weibo"
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.weibo
  const charCount = content.length
  const charPct = Math.min((charCount / cfg.maxChars) * 100, 100)

  // 平台差异化预览
  const renderPreview = () => {
    if (!content) return null
    if (platform === "weibo") {
      return (
        <div className="bg-stone-50 dark:bg-stone-900 rounded-lg p-3 text-sm border">
          <p className="font-medium text-xs text-muted-foreground mb-1">{cfg.emoji} 微博预览</p>
          <p>{content.split(/#\w+/g).map((part, i) => (
            <>
              {part}
              {content.match(/#\w+/g)?.[i] && (
                <span className="text-blue-500 font-medium">#{content.match(/#\w+/g)?.[i]?.slice(1)}#</span>
              )}
            </>
          ))}</p>
          <p className="text-xs text-muted-foreground mt-1">{charCount}/{cfg.maxChars}</p>
        </div>
      )
    }
    if (platform === "xiaohongshu") {
      return (
        <div className="bg-pink-50 dark:bg-pink-950/20 rounded-lg p-3 text-sm border border-pink-100">
          <p className="font-medium text-xs text-pink-500 mb-1">{cfg.emoji} 小红书预览</p>
          <p className="line-clamp-4">{content}</p>
          <p className="text-xs text-muted-foreground mt-1">字数 {charCount}（建议 300-800）</p>
        </div>
      )
    }
    if (platform === "bilibili") {
      return (
        <div className="bg-pink-50 dark:bg-pink-950/20 rounded-lg p-3 border border-pink-100">
          <p className="font-medium text-xs text-pink-600 mb-1">{cfg.emoji} B站专栏预览</p>
          {title && <p className="font-bold text-sm mb-1">{title}</p>}
          <p className="text-sm line-clamp-3">{content}</p>
        </div>
      )
    }
    return (
      <div className="bg-stone-50 dark:bg-stone-900 rounded-lg p-3 text-sm border">
        <p className="font-medium text-xs text-muted-foreground mb-1">{cfg.emoji} {cfg.name} 预览</p>
        <p className="line-clamp-3">{content}</p>
      </div>
    )
  }

  const handleSave = async () => {
    if (!content.trim()) { toast.error("内容不能为空"); return }
    setSaving(true)
    try {
      await onSave({ content, account_id: accountId, title: title || undefined, scheduled_at: scheduledAt || undefined })
      onOpenChange(false)
    } finally { setSaving(false) }
  }

  const handlePublish = async () => {
    if (!content.trim()) { toast.error("内容不能为空"); return }
    if (!accountId) { toast.error("请先选择发布账号"); return }
    setPublishing(true)
    try {
      await onPublish?.({ content, account_id: accountId, title: title || undefined })
      onOpenChange(false)
    } finally { setPublishing(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? "编辑内容" : "创建内容"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {accounts.length > 0 ? (
            <div className="space-y-1.5">
              <Label>发布平台</Label>
              <Select value={accountId} onValueChange={v => setAccountId(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="选择平台账号" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => {
                    const c = PLATFORM_CONFIG[a.platform] || { name: a.platform }
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        {c.emoji} {a.account_name || c.name} {a.is_active ? "" : "(已停用)"}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-amber-500/10 text-amber-600 dark:bg-amber-900/20 p-2 rounded">
              请先在下方「账号管理」添加平台账号
            </p>
          )}

          {(platform === "bilibili" || platform === "zhihu") && (
            <div className="space-y-1.5">
              <Label>标题</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="输入标题..." />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>内容</Label>
              <span className={cn("text-xs", charCount > cfg.maxChars ? "text-red-500" : "text-muted-foreground")}>
                {charCount}/{cfg.maxChars}
              </span>
            </div>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="写点什么..."
              className="min-h-32"
            />
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className={cn("h-full transition-all", charPct > 100 ? "bg-red-500" : charPct > 80 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(charPct, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>定时发布</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>

          {renderPreview()}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="outline" onClick={handleSave} disabled={saving || publishing}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            保存草稿
          </Button>
          {onPublish && (
            <Button onClick={handlePublish} disabled={saving || publishing || !accountId}>
              {publishing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Send className="h-4 w-4 mr-1" />
              发布
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Add Account Dialog ----
function AddAccountDialog({ open, onOpenChange, onAdd }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdd: (platform: string, accountName: string) => Promise<void>
}) {
  const [platform, setPlatform] = useState("weibo")
  const [accountName, setAccountName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!accountName.trim()) { toast.error("请输入账号名称"); return }
    setLoading(true)
    try {
      await onAdd(platform, accountName)
      onOpenChange(false)
      setAccountName("")
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加平台账号</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>平台</Label>
            <Select value={platform} onValueChange={v => setPlatform(v || "weibo")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.emoji} {cfg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>账号名称</Label>
            <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="例如：我的微博" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SocialPage() {
  const {
    accounts, posts, trendingTopics, loading,
    fetchAccounts, fetchPosts, fetchTrendingTopics,
    addAccount, removeAccount, toggleAccount, syncAccount,
    addPost, updatePost, deletePost, schedulePost,
    publishPost,
  } = useSocialStore()

  const [tab, setTab] = useState("all")
  const [editorOpen, setEditorOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)

  useEffect(() => {
    fetchAccounts()
    fetchPosts()
    fetchTrendingTopics()
  }, [])

  const filteredPosts = posts.filter(p => {
    if (tab === "all") return true
    if (tab === "published") return p.status === "published"
    if (tab === "draft") return p.status === "draft" || p.status === "scheduled"
    return true
  })

  const handleAddAccount = async (platform: string, accountName: string) => {
    await addAccount({
      platform: platform as SocialAccount["platform"],
      account_name: accountName,
      account_id: "",
      access_token: "",
      is_active: true,
    })
  }

  const handleSavePost = async (data: { content: string; account_id: string; title?: string; scheduled_at?: string }) => {
    if (editingPost) {
      await updatePost(editingPost.id, {
        content: data.content,
        title: data.title,
        scheduled_at: data.scheduled_at,
        status: data.scheduled_at ? "scheduled" : "draft",
      })
    } else {
      const selAcc = accounts.find(a => a.id === data.account_id);
      await addPost({
        content: data.content,
        account_id: data.account_id,
        platform: selAcc?.platform || 'weibo',
        status: data.scheduled_at ? 'scheduled' : 'draft',
        title: data.title,
        scheduled_at: data.scheduled_at,
      });
    }
    setEditingPost(null)
    fetchPosts()
  }

  const handlePublishPost = async (data: { content: string; account_id: string; title?: string }) => {
    if (!data.account_id) {
      toast.error("请先选择发布账号")
      return
    }
    const account = accounts.find(a => a.id === data.account_id)
    // 先创建帖子，再发布
    const postId = await addPost({
      content: data.content,
      account_id: data.account_id,
      platform: account?.platform || 'weibo',
      status: 'draft',
      title: data.title,
    })
    if (postId) {
      await publishPost(postId, data.account_id, data.content, data.title, account?.platform)
      fetchPosts()
    }
  }

  const handleDeletePost = async (id: string) => {
    await deletePost(id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">社交媒体</h1>
          <p className="text-muted-foreground text-sm">统一管理社交媒体账号和内容发布</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTrendingTopics} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新热榜
          </Button>
          <Button className="gap-2 btn-press" onClick={() => { setEditingPost(null); setEditorOpen(true) }}>
            <Plus className="h-4 w-4" />
            创建内容
          </Button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(accounts.length > 0 ? accounts : Object.entries(PLATFORM_CONFIG).slice(0, 3).map(([k, v]) => ({
          platform: k, account_name: v.name, follower_count: 0, is_active: false, id: k
        }))).slice(0, 3).map((p) => {
          const cfg = PLATFORM_CONFIG[p.platform] || { name: p.platform, emoji: "📱", color: "bg-gray-500" }
          return (
            <Card key={p.id} className={cn("card-glow", !p.is_active && "opacity-50")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-white text-lg flex-shrink-0", cfg.color)}>
                    {cfg.emoji}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.account_name || cfg.name}</p>
                    {p.follower_count !== undefined && p.follower_count > 0 ? (
                      <p className="text-lg font-bold">{p.follower_count.toLocaleString()}</p>
                    ) : (
                      <p className="text-lg font-bold text-muted-foreground">-</p>
                    )}
                  </div>
                </div>
                {p.is_active && p.follower_count !== undefined && p.follower_count > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span>数据已同步</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Account Management */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold">账号管理</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddAccountOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            添加账号
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>暂无已连接的账号</p>
              <p className="mt-1">点击上方「添加账号」开始管理您的社交媒体</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(a => (
                <AccountCard
                  key={a.id}
                  account={a}
                  onRemove={() => removeAccount(a.id)}
                  onToggle={v => toggleAccount(a.id, v)}
                  onSync={() => syncAccount(a.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">内容概览</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="published">已发布</TabsTrigger>
              <TabsTrigger value="draft">草稿 / 待发布</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">暂无内容</p>
                <Button variant="link" className="mt-2" onClick={() => { setEditingPost(null); setEditorOpen(true) }}>
                  创建第一条内容
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map(post => {
                  const cfg = PLATFORM_CONFIG[post.platform] || { name: post.platform, emoji: "📱", color: "bg-gray-500" }
                  return (
                    <div key={post.id} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-md text-white text-sm flex-shrink-0", cfg.color)}>
                        {cfg.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {post.title && <p className="text-sm font-semibold truncate">{post.title}</p>}
                            <p className={cn("text-sm truncate", !post.title && "font-medium")}>{post.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">{cfg.name}</Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(post.created_at)}
                              </span>
                              {post.published_at && (
                                <a href={post.post_url || "#"} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-500 flex items-center gap-0.5 hover:underline">
                                  <ExternalLink className="h-3 w-3" />查看
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="secondary" className={cn(
                              "text-xs",
                              post.status === "published" && "bg-emerald-500/10 text-emerald-600",
                              post.status === "scheduled" && "bg-blue-500/10 text-blue-600",
                              post.status === "failed" && "bg-red-500/10 text-red-600",
                              post.status === "draft" && "bg-amber-500/10 text-amber-600",
                            )}>
                              {STATUS_LABELS[post.status] || post.status}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setEditingPost(post); setEditorOpen(true) }}>
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => handleDeletePost(post.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {post.status === "published" && post.published_at && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />-</span>
                            <span>❤️ -</span>
                            <span>💬 -</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PostEditor
        open={editorOpen}
        onOpenChange={v => { setEditorOpen(v); if (!v) setEditingPost(null) }}
        accounts={accounts}
        post={editingPost}
        onSave={handleSavePost}
        onPublish={editingPost ? undefined : handlePublishPost}
      />
      <AddAccountDialog
        open={addAccountOpen}
        onOpenChange={setAddAccountOpen}
        onAdd={handleAddAccount}
      />
    </div>
  )
}
