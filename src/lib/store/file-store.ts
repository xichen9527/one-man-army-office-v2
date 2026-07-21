'use client'
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ==================== Types ====================
export interface DBFile {
  id: string
  name: string
  file_path: string
  file_size: number | null
  mime_type?: string
  project_id?: string
  task_id?: string
  uploader_id: string      // maps to DB column 'uploaded_by'
  public_url?: string      // computed from storage, not a DB column
  created_at: string
  updated_at?: string
}

// ==================== Store ====================
interface FileStore {
  files: DBFile[]
  loading: boolean
  uploadProgress: number | null

  fetchFiles: (projectId?: string, taskId?: string) => Promise<void>
  uploadFile: (file: File, projectId?: string, taskId?: string, onProgress?: (pct: number) => void) => Promise<DBFile | null>
  deleteFile: (id: string) => Promise<void>
  downloadFile: (id: string) => Promise<string | null>
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  loading: false,
  uploadProgress: null,

  fetchFiles: async (projectId, taskId) => {
    const supabase = createClient()
    set({ loading: true })
    try {
      let query = supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectId) query = query.eq('project_id', projectId)
      if (taskId) query = query.eq('task_id', taskId)

      const { data, error } = await query
      if (error) { toast.error('获取文件列表失败'); set({ loading: false }); return }

      // Map DB column names to our interface, and compute public_url
      const files: DBFile[] = (data || []).map((f: any) => {
        let publicUrl = ''
        try {
          const { data: urlData } = supabase.storage.from('files').getPublicUrl(f.file_path)
          publicUrl = urlData?.publicUrl || ''
        } catch { /* ignore */ }

        return {
          ...f,
          uploader_id: f.uploaded_by || f.uploader_id || '',
          public_url: publicUrl,
        }
      })

      set({ files, loading: false })
    } catch {
      toast.error('获取文件列表失败')
      set({ loading: false })
    }
  },

  uploadFile: async (file, projectId, taskId, onProgress) => {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('请先登录'); return null }

      set({ uploadProgress: 0 })
      const ext = file.name.split('.').pop() || ''
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('files').getPublicUrl(filePath)
      const publicUrl = urlData?.publicUrl || ''

      const { data: dbRecord, error: dbError } = await supabase
        .from('files')
        .insert({
          name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          project_id: projectId || null,
          task_id: taskId || null,
          uploaded_by: user.id,
        } as Record<string, unknown>)
        .select()
        .single()

      if (dbError) throw dbError

      const enriched: DBFile = {
        ...dbRecord,
        uploader_id: (dbRecord as any).uploaded_by || '',
        public_url: publicUrl,
      }

      set(state => ({ files: [enriched, ...state.files], uploadProgress: null }))
      toast.success(`「${file.name}」上传成功`)
      return enriched
    } catch (e: any) {
      set({ uploadProgress: null })
      toast.error(e.message || '上传失败')
      return null
    }
  },

  deleteFile: async (id) => {
    const supabase = createClient()
    try {
      const file = get().files.find(f => f.id === id)
      if (!file) return

      // delete from storage
      if (file.file_path) {
        await supabase.storage.from('files').remove([file.file_path])
      }

      // delete from DB
      const { error } = await supabase.from('files').delete().eq('id', id)
      if (error) throw error

      set(state => ({ files: state.files.filter(f => f.id !== id) }))
      toast.success('文件已删除')
    } catch (e: any) {
      toast.error(e.message || '删除失败')
    }
  },

  downloadFile: async (id) => {
    const supabase = createClient()
    try {
      const file = get().files.find(f => f.id === id)
      if (!file) return null

      const { data, error } = await supabase.storage
        .from('files')
        .download(file.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)

      return url
    } catch (e: any) {
      toast.error(e.message || '下载失败')
      return null
    }
  },
}))
