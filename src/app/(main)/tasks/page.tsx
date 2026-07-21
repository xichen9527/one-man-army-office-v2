'use client'
import React, { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckSquare, Plus, Filter, GripVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTaskStore, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from "@/lib/store/task-store"
import type { Task, TaskStatus, TaskPriority } from "@/lib/store/task-store"
import { useProjectStore } from "@/lib/store/project-store"

const COLUMNS: { id: TaskStatus; label: string; icon: string }[] = [
  { id: "todo", label: "待办", icon: "todo" },
  { id: "in_progress", label: "进行中", icon: "progress" },
  { id: "done", label: "已完成", icon: "done" },
]

export default function TasksPage() {
  const { tasks, loading, fetchTasks, createTask, updateTask, deleteTask, updateTaskStatus } = useTaskStore()
  const { projects, fetchProjects } = useProjectStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [form, setForm] = useState({ title: "", description: "", project_id: "", priority: "medium" as TaskPriority, due_date: "" })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { fetchTasks(); fetchProjects() }, [fetchTasks, fetchProjects])

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => { acc[col.id] = tasks.filter(t => t.status === col.id); return acc }, {})

  const handleCreate = async () => {
    if (!form.title.trim()) return
    await createTask({ title: form.title, description: form.description || undefined, project_id: form.project_id || undefined, priority: form.priority, due_date: form.due_date || undefined })
    setForm({ title: "", description: "", project_id: "", priority: "medium", due_date: "" })
    setCreateOpen(false)
  }

  const handleEdit = async () => {
    if (!editTask || !form.title.trim()) return
    await updateTask(editTask.id, { title: form.title, description: form.description || undefined, project_id: form.project_id || undefined, priority: form.priority, due_date: form.due_date || undefined })
    setEditTask(null)
  }

  const openEdit = (task: Task) => {
    setForm({ title: task.title, description: task.description || "", project_id: task.project_id || "", priority: task.priority, due_date: task.due_date ? task.due_date.split("T")[0] : "" })
    setEditTask(task)
  }

  const handleDelete = async (id: string) => { if (!confirm("确定要删除这个任务吗？")) return; await deleteTask(id) }

  const handleDragStart = (event: DragStartEvent) => { const task = tasks.find(t => t.id === event.active.id); if (task) setActiveTask(task) }
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    let newStatus: TaskStatus | null = null
    if (COLUMNS.some(c => c.id === over.id)) { newStatus = over.id as TaskStatus }
    else { const overTask = tasks.find(t => t.id === over.id); if (overTask) newStatus = overTask.status }
    if (newStatus && newStatus !== task.status) await updateTaskStatus(taskId, newStatus)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务管理</h1>
          <p className="text-muted-foreground">查看和管理您的所有任务</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1"><Filter className="h-3.5 w-3.5" />筛选</Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1 btn-press"><Plus className="h-3.5 w-3.5" />新建任务</Button>} />
            <DialogContent>
              <DialogHeader><DialogTitle>新建任务</DialogTitle><DialogDescription>创建一个新的待办任务</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2"><Label htmlFor="task-title">任务名称 *</Label><Input id="task-title" placeholder="例如：完成项目启动报告" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="grid gap-2"><Label htmlFor="task-desc">描述</Label><Textarea id="task-desc" placeholder="任务详情（可选）" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>所属项目</Label>
                    <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v ?? "" }))}>
                      <SelectTrigger><SelectValue placeholder="选择项目（可选）" /></SelectTrigger>
                      <SelectContent><SelectItem value="">无项目</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>优先级</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">低优先级</SelectItem>
                        <SelectItem value="medium">中优先级</SelectItem>
                        <SelectItem value="high">高优先级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label htmlFor="task-due">截止日期</Label><Input id="task-due" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button><Button onClick={handleCreate} disabled={!form.title.trim()}>创建任务</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {COLUMNS.map(col => (<div key={col.id} className="flex flex-col gap-3"><div className="flex items-center gap-2 px-1"><h3 className="font-semibold text-sm">{col.label}</h3><Badge variant="secondary" className="ml-auto text-xs">—</Badge></div>{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {COLUMNS.map(col => (
              <div key={col.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <Badge variant="secondary" className="ml-auto text-xs">{tasksByStatus[col.id]?.length ?? 0}</Badge>
                </div>
                <SortableContext items={tasksByStatus[col.id].map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {tasksByStatus[col.id].map(task => <SortableTaskCard key={task.id} task={task} onEdit={() => openEdit(task)} onDelete={() => handleDelete(task.id)} />)}
                    {tasksByStatus[col.id].length === 0 && <div className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed text-muted-foreground/40 text-xs">拖拽任务到这里</div>}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>
          <DragOverlay>{activeTask ? <div className="rounded-lg border border-primary/30 bg-card p-3 shadow-xl ring-2 ring-primary/20 opacity-95"><p className="text-sm font-medium">{activeTask.title}</p><p className="text-xs text-muted-foreground mt-1">{TASK_STATUS_LABELS[activeTask.status]}</p></div> : null}</DragOverlay>
        </DndContext>
      )}

      <Dialog open={!!editTask} onOpenChange={open => !open && setEditTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑任务</DialogTitle><DialogDescription>修改任务信息</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="edit-task-title">任务名称 *</Label><Input id="edit-task-title" placeholder="任务名称" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="edit-task-desc">描述</Label><Textarea id="edit-task-desc" placeholder="任务详情" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>所属项目</Label><Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v ?? "" }))}><SelectTrigger><SelectValue placeholder="选择项目（可选）" /></SelectTrigger><SelectContent><SelectItem value="">无项目</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-2"><Label>优先级</Label><Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TaskPriority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">低优先级</SelectItem><SelectItem value="medium">中优先级</SelectItem><SelectItem value="high">高优先级</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="edit-task-due">截止日期</Label><Input id="edit-task-due" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditTask(null)}>取消</Button><Button onClick={handleEdit} disabled={!form.title.trim()}>保存修改</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SortableTaskCardProps { task: Task; onEdit: () => void; onDelete: () => void }
function SortableTaskCard({ task, onEdit, onDelete }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border bg-card p-3 cursor-pointer hover:border-primary/30 transition-all group ${isDragging ? "shadow-lg" : ""}`}>
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground transition-colors active:cursor-grabbing" onClick={e => e.stopPropagation()}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {task.project_name && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.project_name}</p>}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className={`text-xs ${TASK_PRIORITY_COLORS[task.priority] || ""}`}>{TASK_PRIORITY_LABELS[task.priority] || task.priority}优先级</Badge>
            {task.due_date && <span className="text-xs text-muted-foreground">{formatDueShort(task.due_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3 w-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  )
}

function formatDueShort(dueDate: string): string {
  const due = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return "已过期"
  if (diffDays === 0) return "今天"
  if (diffDays === 1) return "明天"
  if (diffDays < 7) return `${diffDays}天`
  return due.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}
