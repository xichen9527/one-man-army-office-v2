'use client'
import { useEffect, useState } from "react"
import { Settings, User, Bell, Shield, Key, Mail, Loader2, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useUserStore, type ApprovalRequest } from "@/lib/store/user-store"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const NOTIFICATION_TYPES = [
  { key: "task_reminder",   label: "任务到期提醒", desc: "任务截止前 1 天通知" },
  { key: "comment",         label: "评论通知",     desc: "当有人评论您的内容时通知" },
  { key: "system",         label: "系统公告",     desc: "接收平台的重要公告" },
  { key: "email_fallback", label: "邮件通知",     desc: "同时发送邮件通知到您的邮箱" },
]

function NotificationSettings() {
  const [prefs, setPrefs] = useState({
    task_reminder: true,
    comment: true,
    system: false,
    email_fallback: false,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">通知偏好</CardTitle>
        <CardDescription>管理您希望接收的通知类型</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_TYPES.map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key as keyof typeof prefs]}
              onCheckedChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ProfileTab() {
  const { profile, fetchProfile, updateProfile, changeEmail } = useUserStore()
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [department, setDepartment] = useState("")
  const [bio, setBio] = useState("")
  const [saving, setSaving] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)

  useEffect(() => { fetchProfile() }, [])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      setUsername(profile.username || "")
      setJobTitle(profile.job_title || "")
      setDepartment(profile.department || "")
      setBio(profile.bio || "")
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        full_name: fullName,
        username: username,
        job_title: jobTitle,
        department: department,
        bio: bio,
      })
    } finally { setSaving(false) }
  }

  const handleEmailChange = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("请输入有效的邮箱地址")
      return
    }
    setEmailLoading(true)
    try {
      await changeEmail(newEmail)
      setEmailDialogOpen(false)
      setNewEmail("")
    } finally { setEmailLoading(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">基本信息</CardTitle>
        <CardDescription>更新您的个人信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>姓名</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="输入姓名" />
          </div>
          <div className="space-y-2">
            <Label>用户名</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="输入用户名" />
          </div>
          <div className="space-y-2">
            <Label>邮箱</Label>
            <div className="flex items-center gap-2">
              <Input value={profile?.email || ""} readOnly className="flex-1" />
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1 flex-shrink-0"><Mail className="h-3.5 w-3.5" />修改</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>修改邮箱</DialogTitle>
                    <DialogDescription>修改次数限制：3次 / 30天</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label>新邮箱地址</Label>
                      <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="your@new-email.com" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      修改后系统会发送验证链接至新邮箱，需点击链接确认后方可生效。
                      {(profile?.email_change_count ?? 0) >= 3 && (
                        <span className="text-amber-600 ml-1">当前已用 {profile?.email_change_count} 次修改机会。</span>
                      )}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>取消</Button>
                    <Button onClick={handleEmailChange} disabled={emailLoading}>
                      {emailLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      发送验证邮件
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="space-y-2">
            <Label>职位</Label>
            <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="产品经理" />
          </div>
          <div className="space-y-2">
            <Label>部门</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="产品部" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>个人简介</Label>
          <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="简单介绍一下自己..." className="min-h-20" />
        </div>
        <Button onClick={handleSave} disabled={saving} className="btn-press">
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          保存更改
        </Button>
      </CardContent>
    </Card>
  )
}

function AISettings() {
  const [configs, setConfigs] = useState<any[]>([])
  const [activeConfig, setActiveConfig] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", baseUrl: "", apiKey: "", model: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ai_api_configs") || "[]")
      setConfigs(stored)
      const active = stored.find((c: any) => c.isDefault) || stored[0]
      setActiveConfig(active)
      if (active) setForm({ name: active.name || "", baseUrl: active.baseUrl || "", apiKey: active.apiKey || "", model: active.model || "" })
    } catch { /* ignore */ }
  }, [])

  const handleSave = async () => {
    if (!form.baseUrl || !form.apiKey || !form.model) {
      toast.error("请填写完整信息（API地址、密钥、模型）")
      return
    }
    setSaving(true)
    try {
      const updated = configs.map(c => c.isDefault ? { ...form, isDefault: true } : c)
      if (!updated.find(c => c.isDefault)) updated.push({ ...form, isDefault: true })
      localStorage.setItem("ai_api_configs", JSON.stringify(updated))
      setConfigs(updated)
      setActiveConfig({ ...form, isDefault: true })
      setEditing(false)
      toast.success("AI 配置已保存")
    } finally { setSaving(false) }
  }

  const handleDelete = (idx: number) => {
    const updated = configs.filter((_: any, i: number) => i !== idx)
    localStorage.setItem("ai_api_configs", JSON.stringify(updated))
    setConfigs(updated)
    if (updated.length === 0) setActiveConfig(null)
    toast.success("已删除")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI 模型配置</CardTitle>
        <CardDescription>配置自定义 API 以使用 AI 功能</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {configs.length > 0 && !editing && (
          <div className="space-y-2">
            {configs.map((cfg, idx) => (
              <div key={idx} className={cn("flex items-center justify-between p-3 rounded-lg border", cfg.isDefault && "border-primary bg-primary/5")}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cfg.name || "未命名配置"}</p>
                    {cfg.isDefault && <Badge variant="default" className="text-xs">使用中</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.baseUrl} · {cfg.model}</p>
                </div>
                <div className="flex gap-1">
                  {!cfg.isDefault && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        const updated = configs.map((c, i) => ({ ...c, isDefault: i === idx }))
                        localStorage.setItem("ai_api_configs", JSON.stringify(updated))
                        setConfigs(updated)
                        toast.success("已设为默认")
                      }}>
                      设为默认
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(idx)}>
                    <Key className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(editing || configs.length === 0) && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>配置名称</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="我的 GPT-4" />
              </div>
              <div className="space-y-1.5">
                <Label>API 地址</Label>
                <Input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
              </div>
              <div className="space-y-1.5">
                <Label>API 密钥</Label>
                <Input type="password" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} placeholder="sk-..." />
              </div>
              <div className="space-y-1.5">
                <Label>模型名称</Label>
                <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="gpt-4o, claude-3-opus..." />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); if (activeConfig) setForm({ name: activeConfig.name || "", baseUrl: activeConfig.baseUrl || "", apiKey: activeConfig.apiKey || "", model: activeConfig.model || "" }) }}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}保存配置
              </Button>
            </div>
          </div>
        )}

        {configs.length > 0 && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">+ 添加配置</Button>
        )}

        {configs.length === 0 && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Key className="h-3.5 w-3.5" />添加 API 配置
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SecurityTab() {
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) { toast.error("密码至少需要 8 位"); return }
    if (newPassword !== confirmPassword) { toast.error("两次密码不一致"); return }
    setPwdLoading(true)
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("密码已修改")
      setPwdDialogOpen(false)
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: any) { toast.error(e.message || "修改失败") }
    finally { setPwdLoading(false) }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户安全</CardTitle>
          <CardDescription>管理您的账户安全设置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">修改密码</p>
              <p className="text-xs text-muted-foreground">密码至少 8 位</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setPwdDialogOpen(true)}>
              <Key className="h-3.5 w-3.5" />修改
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">两步验证</p>
              <p className="text-xs text-muted-foreground">增强账户安全</p>
            </div>
            <Button variant="outline" size="sm">启用</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">活跃会话</p>
              <p className="text-xs text-muted-foreground">当前有 1 个活跃会话</p>
            </div>
            <Button variant="destructive" size="sm">全部登出</Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>修改密码</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>新密码</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 8 位" />
            </div>
            <div className="space-y-1.5">
              <Label>确认密码</Label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再输一次" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdDialogOpen(false)}>取消</Button>
            <Button onClick={handlePasswordChange} disabled={pwdLoading}>
              {pwdLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ApprovalsTab() {
  const { approvals, approvalsLoading, fetchApprovals, createApproval, approveRequest, rejectRequest } = useUserStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [type, setType] = useState<ApprovalRequest["type"]>("expense")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchApprovals() }, [])

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("请输入标题"); return }
    setSubmitting(true)
    try {
      await createApproval({
        title, description: description || undefined, type,
        amount: amount ? parseFloat(amount) : undefined, status: "pending",
      })
      setCreateOpen(false); setTitle(""); setDescription(""); setAmount("")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">审批请求</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">+ 新建审批</Button>
      </div>

      {approvalsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : approvals.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">暂无审批请求</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {approvals.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <Badge variant="secondary" className="text-xs">{a.type}</Badge>
                      <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                        className={cn("text-xs", a.status === "approved" && "bg-emerald-500/10 text-emerald-600", a.status === "pending" && "bg-amber-500/10 text-amber-600")}>
                        {a.status === "pending" ? "待审批" : a.status === "approved" ? "已批准" : "已拒绝"}
                      </Badge>
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mb-1">{a.description}</p>}
                    {a.amount && <p className="text-sm font-semibold">¥{a.amount.toLocaleString()}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString("zh-CN")}</p>
                  </div>
                  {a.status === "pending" && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600" onClick={() => approveRequest(a.id)}>
                        <Check className="h-3 w-3 mr-0.5" />批准
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => rejectRequest(a.id)}>
                        <AlertCircle className="h-3 w-3 mr-0.5" />拒绝
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建审批请求</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={type} onValueChange={v => setType(v as ApprovalRequest["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">费用报销</SelectItem>
                  <SelectItem value="leave">请假</SelectItem>
                  <SelectItem value="purchase">采购</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>标题</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="审批标题" />
            </div>
            <div className="space-y-1.5">
              <Label>说明</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="详细说明..." className="min-h-16" />
            </div>
            {type === "expense" && (
              <div className="space-y-1.5">
                <Label>金额</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}提交审批
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-muted-foreground text-sm">管理您的账户和系统偏好</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" />个人资料
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs">
            <Bell className="h-3.5 w-3.5" />通知
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />AI 模型
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-xs">
            <Shield className="h-3.5 w-3.5" />安全
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-4">
          <ProfileTab />
          <ApprovalsTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 space-y-4">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="ai" className="mt-6 space-y-4">
          <AISettings />
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-4">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
