'use client'
import { useEffect, useState } from 'react'
import { FolderKanban, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useProjectStore } from '@/lib/store/project-store'

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  archived: 'bg-muted text-muted-foreground',
}

const PROJECT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#14b8a6', // teal
]

export default function ProjectsPage() {
  const { projects, loading, fetchProjects, createProject, updateProject, deleteProject, submitting } =
    useProjectStore()

  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#6366f1' })

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Fill edit form when opening edit dialog
  useEffect(() => {
    if (editProject) {
      const p = projects.find(p => p.id === editProject)
      if (p) {
        setForm({ name: p.name, description: p.description || '', color: p.color || '#6366f1' })
      }
    }
  }, [editProject, projects])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    await createProject(form)
    setForm({ name: '', description: '', color: '#6366f1' })
    setCreateOpen(false)
  }

  const handleEdit = async () => {
    if (!editProject || !form.name.trim()) return
    await updateProject(editProject, { name: form.name, description: form.description, color: form.color })
    setEditProject(null)
    setForm({ name: '', description: '', color: '#6366f1' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？')) return
    await deleteProject(id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
          <p className="text-muted-foreground">管理您的所有项目和工作空间</p>
        </div>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button className="gap-2 btn-press"><Plus className="h-4 w-4" />新建项目</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建项目</DialogTitle>
              <DialogDescription>创建一个新的项目来管理工作任务</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="name">项目名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：AI 协作平台"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="简要描述项目目标和范围"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>颜色</Label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`h-8 w-8 rounded-lg transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={submitting || !form.name.trim()}>
                {submitting ? '创建中...' : '创建项目'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="card-glow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-32 mt-3" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-1.5 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-1">暂无项目</h3>
          <p className="text-sm text-muted-foreground mb-4">创建您的第一个项目开始管理任务</p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            新建项目
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const progress = project.task_count && project.task_count > 0
              ? Math.round(((project.done_count || 0) / project.task_count) * 100)
              : 0

            return (
              <Card key={project.id} className="card-glow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: (project.color || '#6366f1') + '20' }}
                    >
                      <FolderKanban
                        className="h-5 w-5"
                        style={{ color: project.color || '#6366f1' }}
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${STATUS_COLORS[project.status] || ''}`}
                      >
                        {STATUS_LABELS[project.status] || project.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>} />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditProject(project.id)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(project.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <CardTitle className="mt-3 text-base font-semibold line-clamp-1">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {project.member_count || 0} 位成员 · {project.task_count || 0} 个任务
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">完成进度</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: project.color || '#6366f1',
                        }}
                      />
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editProject} onOpenChange={open => !open && setEditProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
            <DialogDescription>修改项目信息</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">项目名称 *</Label>
              <Input
                id="edit-name"
                placeholder="项目名称"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">描述</Label>
              <Textarea
                id="edit-desc"
                placeholder="项目描述"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>颜色</Label>
              <div className="flex gap-2 flex-wrap">
                {PROJECT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`h-8 w-8 rounded-lg transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>取消</Button>
            <Button onClick={handleEdit} disabled={submitting || !form.name.trim()}>
              {submitting ? '保存中...' : '保存修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
