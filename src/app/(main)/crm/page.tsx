'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Search, Phone, Mail, X, ChevronRight, Trash2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCrmStore, type Customer, type SalesOpportunity, type OpportunityStage, type CustomerStatus } from '@/lib/store/crm-store'
import { toast } from 'sonner'

const STAGE_ORDER: OpportunityStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
const STAGE_COLORS: Record<OpportunityStage, string> = {
  'prospecting': 'border-slate-400 bg-slate-50',
  'qualification': 'border-blue-400 bg-blue-50',
  'proposal': 'border-amber-400 bg-amber-50',
  'negotiation': 'border-purple-400 bg-purple-50',
  'closed_won': 'border-emerald-500 bg-emerald-50',
  'closed_lost': 'border-red-400 bg-red-50',
}
const STAGE_LABELS: Record<OpportunityStage, string> = {
  'prospecting': '线索',
  'qualification': '需求分析',
  'proposal': '方案报价',
  'negotiation': '谈判',
  'closed_won': '成交',
  'closed_lost': '输单',
}
const STATUS_COLORS: Record<string, string> = {
  'won': 'bg-emerald-500/10 text-emerald-600',
  'new': 'bg-amber-500/10 text-amber-600',
  'contacted': 'bg-blue-500/10 text-blue-600',
  'lost': 'bg-red-500/10 text-red-600',
  'qualified': 'bg-purple-500/10 text-purple-600',
  'proposal': 'bg-indigo-500/10 text-indigo-600',
  'negotiation': 'bg-cyan-500/10 text-cyan-600',
}
const STATUS_LABELS: Record<string, string> = {
  'new': '新客户',
  'contacted': '已联系',
  'qualified': '已合格',
  'proposal': '方案中',
  'negotiation': '谈判中',
  'won': '已成交',
  'lost': '已流失',
}
const STATUS_OPTIONS: CustomerStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function formatCurrency(v?: number) {
  if (!v) return '待定'
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}万`
  return `¥${v.toLocaleString()}`
}

export default function CRMPage() {
  const {
    customers, opportunities, loading, searchQuery, statusFilter,
    fetchCustomers, fetchOpportunities, createCustomer, updateCustomer, deleteCustomer,
    createOpportunity, updateOpportunityStage, deleteOpportunity, fetchSalesFunnelStats,
    setSearchQuery, setStatusFilter,
  } = useCrmStore()

  const [tab, setTab] = useState<'customers' | 'funnel' | 'opportunities'>('customers')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showOppForm, setShowOppForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  // Customer form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formStatus, setFormStatus] = useState<CustomerStatus>('new')
  const [formIndustry, setFormIndustry] = useState('')
  const [formSource, setFormSource] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Opportunity form state
  const [oppTitle, setOppTitle] = useState('')
  const [oppAmount, setOppAmount] = useState('')
  const [oppStage, setOppStage] = useState<OpportunityStage>('prospecting')
  const [oppCustomerId, setOppCustomerId] = useState('')

  useEffect(() => {
    fetchCustomers()
    fetchOpportunities()
  }, [])

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    const matchStatus = statusFilter === '全部' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const funnelStats = fetchSalesFunnelStats()

  // Funnel: group opportunities by stage
  const funnelColumns = STAGE_ORDER.map(stage => ({
    stage,
    opportunities: opportunities.filter(o => o.stage === stage),
    stats: funnelStats.find(s => s.stage === stage)!,
  }))

  const openCustomerForm = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormName(customer.name)
      setFormEmail(customer.email || '')
      setFormPhone(customer.phone || '')
      setFormCompany(customer.company || '')
      setFormStatus(customer.status)
      setFormIndustry(customer.industry || '')
      setFormSource(customer.source || '')
      setFormNotes(customer.notes || '')
    } else {
      setEditingCustomer(null)
      setFormName(''); setFormEmail(''); setFormPhone(''); setFormCompany('')
      setFormStatus('new'); setFormIndustry(''); setFormSource(''); setFormNotes('')
    }
    setShowCustomerForm(true)
  }

  const handleSaveCustomer = async () => {
    if (!formName.trim()) { toast.error('请输入客户名称'); return }
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, {
        name: formName, email: formEmail, phone: formPhone,
        company: formCompany, status: formStatus, industry: formIndustry, source: formSource, notes: formNotes,
      })
    } else {
      await createCustomer({
        name: formName, email: formEmail, phone: formPhone,
        company: formCompany, status: formStatus, industry: formIndustry, source: formSource, notes: formNotes,
      })
    }
    setShowCustomerForm(false)
  }

  const handleSaveOpp = async () => {
    if (!oppTitle.trim()) { toast.error('请输入商机名称'); return }
    await createOpportunity({
      customer_id: oppCustomerId,
      title: oppTitle,
      stage: oppStage,
      amount: oppAmount ? parseFloat(oppAmount) : undefined,
    })
    setShowOppForm(false)
    setOppTitle(''); setOppAmount(''); setOppStage('prospecting'); setOppCustomerId('')
  }

  // Simple stage update via click
  const handleStageClick = async (opp: SalesOpportunity) => {
    const idx = STAGE_ORDER.indexOf(opp.stage)
    if (idx < STAGE_ORDER.length - 1) {
      await updateOpportunityStage(opp.id, STAGE_ORDER[idx + 1])
    }
  }

  const totalOpportunities = opportunities.length
  const totalAmount = opportunities.reduce((s, o) => s + (o.amount || 0), 0)
  const closedAmount = opportunities.filter(o => o.stage === 'closed_won').reduce((s, o) => s + (o.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">管理客户关系和商机</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setOppCustomerId(''); setShowOppForm(true) }}>
            <Plus className="h-4 w-4" /> 新建商机
          </Button>
          <Button size="sm" className="gap-2 btn-press" onClick={() => openCustomerForm()}>
            <Plus className="h-4 w-4" /> 添加客户
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">客户总数</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">已成交 {customers.filter(c => c.status === 'won').length} 个</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">商机总额</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalOpportunities} 个商机</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">已成交</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(closedAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">成交率 {totalOpportunities ? Math.round(opportunities.filter(o => o.stage === 'closed_won').length / totalOpportunities * 100) : 0}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="customers">客户列表</TabsTrigger>
          <TabsTrigger value="funnel">销售漏斗</TabsTrigger>
          <TabsTrigger value="opportunities">商机列表</TabsTrigger>
        </TabsList>

        {/* Customer List */}
        <TabsContent value="customers" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="搜索客户..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {(['全部', ...STATUS_OPTIONS] as const).map(s => (
                <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>{s === '全部' ? '全部' : STATUS_LABELS[s]}</Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="grid grid-cols-5 gap-4 p-4 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <span>客户</span><span>联系人</span><span>状态</span><span>行业</span><span>操作</span>
            </div>
            {filteredCustomers.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-5 items-center gap-4 p-4 border-t hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => setSelectedCustomer(c)}
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{c.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{c.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground truncate">{c.email || c.phone || '—'}</span>
                </div>
                <Badge className={STATUS_COLORS[c.status] || 'bg-muted'}>{STATUS_LABELS[c.status] || c.status}</Badge>
                <span className="text-sm text-muted-foreground truncate">{c.industry || '—'}</span>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCustomerForm(c)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCustomer(c.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">暂无客户</div>
            )}
          </div>
        </TabsContent>

        {/* Funnel */}
        <TabsContent value="funnel">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {funnelColumns.map(({ stage, opportunities: opps, stats }) => (
              <div key={stage} className={`min-w-48 flex-1 rounded-xl border-2 p-4 ${STAGE_COLORS[stage]}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
                  <Badge variant="outline">{stats.count}</Badge>
                </div>
                <p className="text-lg font-bold">{formatCurrency(stats.totalAmount)}</p>
                <div className="space-y-2 mt-3">
                  {opps.map(opp => (
                    <div
                      key={opp.id}
                      className="rounded-lg bg-white/80 p-2 text-xs cursor-pointer hover:bg-white transition-colors"
                      onClick={() => handleStageClick(opp)}
                      title={`点击推进到下一阶段: ${opp.title}`}
                    >
                      <p className="font-medium truncate">{opp.title}</p>
                      <p className="text-muted-foreground">{opp.customer_name || '—'}</p>
                      <p className="font-medium text-primary">{formatCurrency(opp.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">💡 点击商机卡片推进到下一阶段</p>
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities">
          <div className="rounded-lg border">
            <div className="grid grid-cols-6 gap-4 p-4 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <span>商机</span><span>客户</span><span>阶段</span><span>金额</span><span>预计成交</span><span>操作</span>
            </div>
            {opportunities.map(opp => (
              <div key={opp.id} className="grid grid-cols-6 items-center gap-4 p-4 border-t hover:bg-muted/20 transition-colors">
                <span className="text-sm font-medium truncate">{opp.title}</span>
                <span className="text-sm text-muted-foreground truncate">{opp.customer_name || '—'}</span>
                <Badge className={`${STAGE_COLORS[opp.stage]} w-fit`}>{STAGE_LABELS[opp.stage]}</Badge>
                <span className="text-sm font-medium">{formatCurrency(opp.amount)}</span>
                <span className="text-xs text-muted-foreground">{opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString('zh-CN') : '—'}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOpportunity(opp.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {opportunities.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">暂无商机</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Customer Detail Sidebar */}
      {selectedCustomer && (
        <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-50 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold truncate">{selectedCustomer.name}</h2>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedCustomer(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={STATUS_COLORS[selectedCustomer.status] || ''}>{STATUS_LABELS[selectedCustomer.status] || selectedCustomer.status}</Badge>
              <span className="text-sm text-muted-foreground">{selectedCustomer.industry || '未知行业'}</span>
            </div>
            {selectedCustomer.company && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />{selectedCustomer.company}
              </div>
            )}
            {selectedCustomer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">{selectedCustomer.email}</a>
              </div>
            )}
            {selectedCustomer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${selectedCustomer.phone}`} className="text-primary hover:underline">{selectedCustomer.phone}</a>
              </div>
            )}
            {selectedCustomer.source && (
              <div className="text-sm text-muted-foreground">来源：{selectedCustomer.source}</div>
            )}
            {selectedCustomer.notes && (
              <p className="text-sm text-muted-foreground mt-2">{selectedCustomer.notes}</p>
            )}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">相关商机</h3>
              {opportunities.filter(o => o.customer_id === selectedCustomer.id).map(opp => (
                <div key={opp.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="truncate">{opp.title}</span>
                  <Badge variant="outline" className="text-xs ml-2">{STAGE_LABELS[opp.stage]}</Badge>
                </div>
              ))}
              {opportunities.filter(o => o.customer_id === selectedCustomer.id).length === 0 && (
                <p className="text-xs text-muted-foreground">暂无商机</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Form Dialog */}
      <Dialog open={showCustomerForm} onOpenChange={setShowCustomerForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCustomer ? '编辑客户' : '添加客户'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>客户名称 *</Label><Input className="mt-1" value={formName} onChange={e => setFormName(e.target.value)} placeholder="公司/客户名称" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>公司</Label><Input className="mt-1" value={formCompany} onChange={e => setFormCompany(e.target.value)} /></div>
              <div><Label>状态</Label>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={formStatus} onChange={e => setFormStatus(e.target.value as CustomerStatus)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>邮箱</Label><Input className="mt-1" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} /></div>
              <div><Label>电话</Label><Input className="mt-1" value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>行业</Label><Input className="mt-1" value={formIndustry} onChange={e => setFormIndustry(e.target.value)} /></div>
              <div><Label>来源</Label><Input className="mt-1" value={formSource} onChange={e => setFormSource(e.target.value)} placeholder="线上/推荐/展会..." /></div>
            </div>
            <div><Label>备注</Label><Input className="mt-1" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="备注信息" /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCustomerForm(false)}>取消</Button>
              <Button onClick={handleSaveCustomer}>{editingCustomer ? '保存' : '添加'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Opportunity Form Dialog */}
      <Dialog open={showOppForm} onOpenChange={setShowOppForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建商机</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>商机名称 *</Label><Input className="mt-1" value={oppTitle} onChange={e => setOppTitle(e.target.value)} placeholder="项目/产品名称" /></div>
            <div><Label>关联客户</Label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={oppCustomerId} onChange={e => setOppCustomerId(e.target.value)}>
                <option value="">不关联</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>金额（元）</Label><Input className="mt-1" type="number" value={oppAmount} onChange={e => setOppAmount(e.target.value)} placeholder="0" /></div>
              <div><Label>阶段</Label>
                <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={oppStage} onChange={e => setOppStage(e.target.value as OpportunityStage)}>
                  {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowOppForm(false)}>取消</Button>
              <Button onClick={handleSaveOpp}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
