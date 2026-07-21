'use client'
import { useEffect } from 'react'
import {
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Activity,
  Clock,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardStore } from '@/lib/store/dashboard-store'

const quickActions = [
  {
    title: '项目管理',
    description: '创建和管理您的项目',
    href: '/projects',
    icon: FolderKanban,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: '任务看板',
    description: '查看和处理待办任务',
    href: '/tasks',
    icon: CheckSquare,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    title: '团队协作',
    description: '实时沟通与文件共享',
    href: '/collaboration',
    icon: MessageSquare,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'AI 助手',
    description: '智能分析与内容生成',
    href: '/ai',
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
]

// Map DB status to display
const DB_STATUS_LABELS: Record<string, string> = {
  todo: '待处理',
  in_progress: '进行中',
  done: '已完成',
  active: '进行中',
  completed: '已完成',
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const { stats, recentTasks, projectProgress, activities, loading, fetchDashboardData } =
    useDashboardStore()

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getGreeting()} 👋
          </h1>
          <p className="text-muted-foreground">
            今天是 {today}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3 text-emerald-500" />
            系统正常
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="活跃项目"
          value={stats?.activeProjects ?? null}
          icon={FolderKanban}
          color="text-primary"
          loading={loading}
        />
        <StatCard
          label="待办任务"
          value={stats?.pendingTasks ?? null}
          icon={CheckSquare}
          color="text-emerald-500"
          loading={loading}
        />
        <StatCard
          label="团队成员"
          value={stats?.teamMembers ?? null}
          icon={Users}
          color="text-blue-500"
          loading={loading}
        />
        <StatCard
          label="本月进度"
          value={stats ? `${stats.monthlyProgress}%` : null}
          icon={TrendingUp}
          color="text-amber-500"
          loading={loading}
          isProgress
          progressValue={stats?.monthlyProgress}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">快捷入口</CardTitle>
            <CardDescription>快速访问常用功能</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50 hover:border-primary/20 group cursor-pointer">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.bgColor}`}>
                      <Icon className={`h-4 w-4 ${action.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {action.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">最近任务</CardTitle>
              <CardDescription>您负责的任务列表</CardDescription>
            </div>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="gap-1">
                查看全部
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">暂无任务</p>
                <Link href="/tasks">
                  <Button variant="link" size="sm" className="mt-2">去创建任务</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>优先级</TableHead>
                    <TableHead>截止</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium text-sm max-w-[200px]">
                        <div className="truncate">{task.title}</div>
                        {task.project_name && (
                          <div className="text-xs text-muted-foreground truncate">{task.project_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-xs"
                        >
                          {DB_STATUS_LABELS[task.status] || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${priorityColor(task.priority)}`}
                        >
                          {priorityLabel(task.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDueDate(task.due_date)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">项目进度</CardTitle>
            <CardDescription>当前项目完成情况</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </>
            ) : projectProgress.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderKanban className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">暂无项目</p>
                <Link href="/projects">
                  <Button variant="link" size="sm" className="mt-2">去创建项目</Button>
                </Link>
              </div>
            ) : (
              projectProgress.map((project) => (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">{project.name}</span>
                    <span className="text-muted-foreground ml-2">{project.progress}%</span>
                  </div>
                  <Progress
                    value={project.progress}
                    className="h-2"
                    style={{ ['--progress-color' as string]: project.color }}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">动态</CardTitle>
            <CardDescription>最近活动记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                ))}
              </>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">暂无动态</p>
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {activity.user_name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user_name}</span>
                      <span className="text-muted-foreground"> {activity.action} </span>
                      <span className="font-medium truncate">{activity.target}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ==================== Helpers ====================

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-red-500/10 text-red-600 dark:text-red-400',
  中: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  高: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  中: '中',
  高: '高',
  低: '低',
}

function priorityColor(p: string): string {
  return PRIORITY_COLORS[p] || 'bg-muted text-muted-foreground'
}

function priorityLabel(p: string): string {
  return PRIORITY_LABELS[p] || p
}

function formatDueDate(dueDate?: string): string {
  if (!dueDate) return '未设置'
  const due = new Date(dueDate)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return '已过期'
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays < 7) return `${diffDays}天后`
  return due.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

interface StatCardProps {
  label: string
  value: string | number | null
  icon: React.ElementType
  color: string
  loading: boolean
  isProgress?: boolean
  progressValue?: number
}

function StatCard({ label, value, icon: Icon, color, loading, isProgress, progressValue }: StatCardProps) {
  return (
    <Card className="card-glow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color.replace('text-', 'bg-')}/10`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-7 w-16 mb-1" />
          ) : (
            <p className="text-2xl font-bold">{value ?? '—'}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
          {isProgress && !loading && progressValue !== undefined && (
            <Progress value={progressValue} className="mt-2 h-1.5" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
