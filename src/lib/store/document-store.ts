'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================
export interface Document {
  id: string
  title: string
  content?: string
  type?: string          // DB column is 'type', not 'doc_type'
  project_id?: string
  task_id?: string
  creator_id: string
  is_template?: boolean
  created_at: string
  updated_at: string
  // Enriched
  project_name?: string
  task_name?: string
}

// Folder type — stored in localStorage as folders table doesn't exist in DB
export interface Folder {
  id: string
  name: string
  parent_id?: string | null
  created_at: string
}

// ==================== Store ====================
interface DocumentStore {
  documents: Document[]
  folders: Folder[]
  loading: boolean
  selectedFolderId: string | null
  searchQuery: string
  selectedProjectId: string | null

  setSelectedFolder: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setSelectedProject: (id: string | null) => void

  fetchDocuments: (projectId?: string | null, taskId?: string | null) => Promise<void>
  createDocument: (data: { title: string; content?: string; type?: string; project_id?: string; task_id?: string }) => Promise<void>
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>
  deleteDocument: (id: string) => Promise<void>

  // Folder operations (localStorage-based, no DB table)
  fetchFolders: () => Promise<void>
  createFolder: (name: string, parentId?: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
}

const FOLDERS_STORAGE_KEY = 'oma_folders'

function loadFoldersFromStorage(): Folder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFoldersToStorage(folders: Folder[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders))
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  folders: [],
  loading: false,
  selectedFolderId: null,
  searchQuery: '',
  selectedProjectId: null,

  setSelectedFolder: (id) => set({ selectedFolderId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),

  fetchDocuments: async (projectId, taskId) => {
    const supabase = createClient()
    set({ loading: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { set({ loading: false }); return }

      let query = supabase
        .from('documents')
        .select(`
          *,
          project:projects!documents_project_id_fkey(name),
          task:tasks!documents_task_id_fkey(title)
        `)
        .eq('creator_id', user.id)
        .order('updated_at', { ascending: false })

      const pid = projectId ?? get().selectedProjectId
      if (pid) query = query.eq('project_id', pid)
      if (taskId) query = query.eq('task_id', taskId)

      const { data, error } = await query
      if (error) {
        // Fallback: try without joins (in case FK names differ)
        let q2 = supabase
          .from('documents')
          .select('*')
          .eq('creator_id', user.id)
          .order('updated_at', { ascending: false })
        if (pid) q2 = q2.eq('project_id', pid)
        if (taskId) q2 = q2.eq('task_id', taskId)
        const { data: data2, error: error2 } = await q2
        if (error2) { toast.error('获取文档失败'); set({ loading: false }); return }
        const enriched: Document[] = (data2 || []).map((d: any) => ({
          ...d,
          project_name: undefined,
          task_name: undefined,
        }))
        set({ documents: enriched, loading: false })
        return
      }

      const enriched: Document[] = (data || []).map((d: any) => ({
        ...d,
        project_name: d.project?.name,
        task_name: d.task?.title,
      }))

      set({ documents: enriched as Document[], loading: false })
    } catch {
      toast.error('获取文档失败')
      set({ loading: false })
    }
  },

  createDocument: async (data) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return }

      const { error } = await supabase
        .from('documents')
        .insert({
          title: data.title,
          content: data.content || '',
          type: data.type || 'markdown',
          project_id: data.project_id || null,
          task_id: data.task_id || null,
          creator_id: user.id,
        } as Record<string, unknown>)

      if (error) throw error

      toast.success('文档已创建')
      await get().fetchDocuments()
    } catch (e: any) {
      toast.error(e.message || '创建失败')
    }
  },

  updateDocument: async (id, updates) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('documents')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      set(state => ({
        documents: state.documents.map(d => d.id === id ? { ...d, ...data } : d)
      }))
      toast.success('文档已更新')
    } catch (e: any) {
      toast.error(e.message || '更新失败')
    }
  },

  deleteDocument: async (id) => {
    const supabase = createClient()
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      set(state => ({ documents: state.documents.filter(d => d.id !== id) }))
      toast.success('文档已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  // Folder operations — localStorage based (no DB folders table)
  fetchFolders: async () => {
    const folders = loadFoldersFromStorage()
    set({ folders })
  },

  createFolder: async (name, parentId) => {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      parent_id: parentId || null,
      created_at: new Date().toISOString(),
    }
    const folders = [...get().folders, folder]
    saveFoldersToStorage(folders)
    set({ folders })
    toast.success('文件夹已创建')
  },

  deleteFolder: async (id) => {
    const folders = get().folders.filter(f => f.id !== id && f.parent_id !== id)
    saveFoldersToStorage(folders)
    set({ folders })
    toast.success('文件夹已删除')
  },
}))
