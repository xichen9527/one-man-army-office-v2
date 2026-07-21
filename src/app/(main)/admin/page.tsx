'use client'

import { useEffect, useState } from 'react'
import { Shield, Users, Database, Activity, Plus, RefreshCw, Trash2, Crown, Eye, UserCheck } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/lib/store/user-store'
import { toast } from 'sonner'

const ROLE_ICONS = {
  admin: <Crown className="h-3 w-3 text-amber-500" />,
  member: <UserCheck className="h-3 w-3 text-blue-500" />,
  viewer: <Eye className="h-3 w-3 text-muted-foreground" />,
}

const ROLE_COLORS = {
  admin: 'bg-amber-500/10 text-amber-600 border-amber-200',
  member: 'bg-blue-500/10 text-blue-600 border-blue-200',
  viewer: 'bg-muted text-muted-foreground border-muted-foreground/20',
}

const STATUS_COLORS = {
  active: 'bg-emerald-500/10 text-emerald-600',
  inactive: 'bg-red-500/10 text-red-600',
  pending: 'bg-amber-500/10 text-amber-600',
}

export default function AdminPage() {
  const { members, invitations, teamLoading, fetchTeamMembers, fetchInvitations, addMember, removeMember, updateMember } = useUserStore()
  const [showAddMember, setShowAddMember] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [systemInfo] = useState({
    nextjs: '15.x',
    react: '19.x',
    node: process.version?.replace('v', '') || '22.x',
    database: 'Supabase',
    deployment: 'Vercel',
    supabase: 'Realtime',
  })

  useEffect(() => {
    fetchTeamMembers()
    fetchInvitations()
  }, [])

  const handleAddMember = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) { toast.error('请输入有效的邮箱地址'); return }
    await addMember(newEmail.trim(), newRole)
    setShowAddMember(false)
    setNewEmail('')
    setNewRole('member')
  }

  const handleRoleChange = async (id: string, role: 'admin' | 'member' | 'viewer') => {
    await updateMember(id, { role })
  }

  const handleStatusChange = async (id: string, status: 'active' | 'inactive') => {
    await updateMember(id, { status })
  }

  const activeCount = members.filter(m => m.status === 'active').length
  const totalCustomers = 0 // could link to CRM store
  const totalDocuments = 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
          <p className="text-muted-foreground">系统管理和团队设置</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { fetchTeamMembers(); fetchInvitations() }}>
            <RefreshCw className="h-4 w-4" /> 刷新
          </Button>
          <Button size="sm" className="gap-2 btn-press" onClick={() => setShowAddMember(true)}>
            <Plus className="h-4 w-4" /> 邀请成员
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="h-5 w-5 text-blue-500" />
              <Badge variant="secondary" className="text-xs">团队成员</Badge>
            </div>
            <p className="text-2xl font-bold mt-3">{members.length}</p>
            <p className="text-xs text-muted-foreground mt-1">活跃 {activeCount} 人</p>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Activity className="h-5 w-5 text-emerald-500" />
              <Badge variant="secondary" className="text-xs">待处理</Badge>
            </div>
            <p className="text-2xl font-bold mt-3">{invitations.filter(i => i.status === 'pending').length}</p>
            <p className="text-xs text-muted-foreground mt-1">待接受邀请</p>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Shield className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-xs">数据库</Badge>
            </div>
            <p className="text-2xl font-bold mt-3">Supabase</p>
            <p className="text-xs text-muted-foreground mt-1">PostgreSQL + Realtime</p>
          </CardContent>
        </Card>
        <Card className="card-glow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Database className="h-5 w-5 text-violet-500" />
              <Badge variant="secondary" className="text-xs">状态</Badge>
            </div>
            <p className="text-2xl font-bold mt-3 text-emerald-500">正常</p>
            <p className="text-xs text-muted-foreground mt-1">所有服务运行中</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">系统信息</CardTitle>
            <CardDescription>当前运行环境</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Next.js 版本', systemInfo.nextjs],
              ['React 版本', systemInfo.react],
              ['Node 版本', systemInfo.node],
              ['数据库', systemInfo.database],
              ['实时引擎', systemInfo.supabase],
              ['部署环境', systemInfo.deployment],
            ].map(([key, val]) => (
              <div key={key} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">待处理邀请</CardTitle>
            <CardDescription>已发送但尚未接受的邀请</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.filter(i => i.status === 'pending').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无待处理邀请</p>
            ) : (
              <div className="space-y-2">
                {invitations.filter(i => i.status === 'pending').map(inv => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">角色：{inv.role}</p>
                    </div>
                    <Badge variant="outline">{inv.status === 'pending' ? '待接受' : inv.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">团队成员</CardTitle>
          <CardDescription>管理成员角色和状态</CardDescription>
        </CardHeader>
        <CardContent>
          {teamLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">暂无团队成员</p>
              <Button variant="outline" className="mt-3 gap-2" onClick={() => setShowAddMember(true)}>
                <Plus className="h-4 w-4" /> 邀请成员
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 p-3 bg-muted/30 rounded-lg text-xs font-semibold text-muted-foreground">
                <span>成员</span><span>角色</span><span>邮箱</span><span>状态</span><span>操作</span>
              </div>
              {members.map(member => (
                <div key={member.id} className="grid grid-cols-5 items-center gap-4 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">{member.full_name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <span className="text-sm font-medium truncate">{member.full_name || '未知成员'}</span>
                  </div>
                  <select
                    className="text-xs rounded-md border border-input bg-background px-2 py-1 max-w-24"
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value as 'admin' | 'member' | 'viewer')}
                  >
                    <option value="admin">管理员</option>
                    <option value="member">成员</option>
                    <option value="viewer">查看者</option>
                  </select>
                  <span className="text-sm text-muted-foreground truncate">{member.email}</span>
                  <select
                    className="text-xs rounded-md border border-input bg-background px-2 py-1 max-w-24"
                    value={member.status || 'pending'}
                    onChange={e => handleStatusChange(member.id, e.target.value as 'active' | 'inactive')}
                  >
                    <option value="active">活跃</option>
                    <option value="inactive">停用</option>
                    <option value="pending">待激活</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeMember(member.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader><DialogTitle>邀请团队成员</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>邮箱地址 *</Label>
              <Input className="mt-1" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="colleague@example.com" />
            </div>
            <div>
              <Label>角色</Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={newRole} onChange={e => setNewRole(e.target.value as typeof newRole)}>
                <option value="admin">管理员 — 可管理团队设置</option>
                <option value="member">成员 — 可使用所有功能</option>
                <option value="viewer">查看者 — 仅可查看内容</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddMember(false)}>取消</Button>
              <Button onClick={handleAddMember}>发送邀请</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
