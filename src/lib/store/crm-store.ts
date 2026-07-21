'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================
export type CustomerStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  position?: string
  status: CustomerStatus
  industry?: string
  source?: string
  website?: string
  address?: string
  notes?: string
  owner_id: string
  last_contact?: string
  created_at: string
  updated_at: string
}

export interface SalesOpportunity {
  id: string
  customer_id: string
  customer_name?: string
  title: string
  stage: OpportunityStage
  amount?: number
  probability?: number
  expected_close_date?: string
  owner_id: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface SalesFunnelStats {
  stage: OpportunityStage
  count: number
  totalAmount: number
}

// ==================== Store ====================
interface CrmStore {
  customers: Customer[]
  opportunities: SalesOpportunity[]
  loading: boolean
  searchQuery: string
  statusFilter: CustomerStatus | '全部'

  setSearchQuery: (q: string) => void
  setStatusFilter: (s: CustomerStatus | '全部') => void

  // Customers
  fetchCustomers: () => Promise<void>
  createCustomer: (data: Omit<Customer, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>

  // Opportunities
  fetchOpportunities: (customerId?: string) => Promise<void>
  createOpportunity: (data: Omit<SalesOpportunity, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateOpportunity: (id: string, updates: Partial<SalesOpportunity>) => Promise<void>
  deleteOpportunity: (id: string) => Promise<void>
  updateOpportunityStage: (id: string, stage: OpportunityStage) => Promise<void>

  // Stats
  fetchSalesFunnelStats: () => SalesFunnelStats[]
}

export const useCrmStore = create<CrmStore>((set, get) => ({
  customers: [],
  opportunities: [],
  loading: false,
  searchQuery: '',
  statusFilter: '全部',

  setSearchQuery: (q) => set({ searchQuery: q }),
  setStatusFilter: (s) => set({ statusFilter: s }),

  // ========== Customers ==========
  fetchCustomers: async () => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ loading: false }); return }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) { toast.error('获取客户失败'); set({ loading: false }); return }
      set({ customers: data || [] })
    } catch {
      toast.error('获取客户失败')
    } finally {
      set({ loading: false })
    }
  },

  createCustomer: async (data) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      const { error } = await supabase
        .from('customers')
        .insert({ ...data, owner_id: user.id } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      toast.success('客户已添加')
      await get().fetchCustomers()
    } catch (e: any) {
      toast.error(e.message || '添加失败')
    }
  },

  updateCustomer: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        customers: state.customers.map(c => c.id === id ? { ...c, ...data } : c)
      }))
      toast.success('客户已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteCustomer: async (id) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
      set(state => ({ customers: state.customers.filter(c => c.id !== id) }))
      toast.success('客户已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  // ========== Opportunities ==========
  fetchOpportunities: async (customerId) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('sales_opportunities')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (customerId) query = query.eq('customer_id', customerId)

      const { data, error } = await query
      if (error) { toast.error('获取商机失败'); return }

      // enrich with customer name
      if (data && data.length > 0) {
        const customerIds = [...new Set(data.map(o => o.customer_id).filter(Boolean))]
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)

        const customerMap: Record<string, string> = {}
        customers?.forEach(c => { customerMap[c.id] = c.name })

        const enriched = data.map(o => ({
          ...o,
          customer_name: customerMap[o.customer_id] || ''
        }))

        set({ opportunities: enriched as SalesOpportunity[] })
      } else {
        set({ opportunities: [] })
      }
    } catch {
      toast.error('获取商机失败')
    }
  },

  createOpportunity: async (data) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      const { error } = await supabase
        .from('sales_opportunities')
        .insert({ ...data, owner_id: user.id } as Record<string, unknown>)
        .select()
        .single()

      if (error) throw error
      toast.success('商机已创建')
      await get().fetchOpportunities()
    } catch (e: any) {
      toast.error(e.message || '创建失败')
    }
  },

  updateOpportunity: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('sales_opportunities')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        opportunities: state.opportunities.map(o => o.id === id ? { ...o, ...data } : o)
      }))
      toast.success('商机已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteOpportunity: async (id) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('sales_opportunities').delete().eq('id', id)
      if (error) throw error
      set(state => ({ opportunities: state.opportunities.filter(o => o.id !== id) }))
      toast.success('商机已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  updateOpportunityStage: async (id, stage) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('sales_opportunities')
        .update({ stage } as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        opportunities: state.opportunities.map(o => o.id === id ? { ...o, ...data } : o)
      }))
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  fetchSalesFunnelStats: () => {
    const stages: OpportunityStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
    const opportunities = get().opportunities

    return stages.map(stage => {
      const filtered = opportunities.filter(o => o.stage === stage)
      return {
        stage,
        count: filtered.length,
        totalAmount: filtered.reduce((sum, o) => sum + (o.amount || 0), 0),
      }
    })
  },
}))
