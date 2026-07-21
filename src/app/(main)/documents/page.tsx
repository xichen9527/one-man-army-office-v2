'use client'

import { useEffect, useState, useRef } from 'react'
import { FileText, Plus, Search, FolderOpen, Upload, File, Image, Film, FileCode, Trash2, Share2, MoreHorizontal, X, Check, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useDocumentStore } from '@/lib/store/document-store'
import { useFileStore } from '@/lib/store/file-store'
import { useProjectStore } from '@/lib/store/project-store'
import { toast } from 'sonner'

const docTypeIcon: Record<string, React.ReactNode> = {
  markdown: <FileText className="h-5 w-5 text-primary" />,
  richtext: <FileText className="h-5 w-5 text-primary" />,
  code: <FileCode className="h-5 w-5 text-emerald-500" />,
  note: <FileText className="h-5 w-5 text-amber-500" />,
  PRD: <FileText className="h-5 w-5 text-primary" />,
  API: <FileCode className="h-5 w-5 text-blue-500" />,
  报告: <FileText className="h-5 w-5 text-amber-500" />,
  周报: <FileText className="h-5 w-5 text-violet-500" />,
}

function FilePreview({ url, name }: { url: string; name: string }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
  const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(name)
  if (isImage) return <img src={url} alt={name} className="max-h-48 rounded-md object-contain" />
  if (isVideo) return <video src={url} controls className="max-h-48 rounded-md" />
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
      <FileCode className="h-8 w-8 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{name}</span>
    </div>
  )
}

export default function DocumentsPage() {
  const {
    documents, folders, loading, selectedFolderId, searchQuery, selectedProjectId,
    fetchDocuments, fetchFolders, createDocument, deleteDocument,
    setSelectedFolder, setSearchQuery, setSelectedProject, createFolder,
  } = useDocumentStore()

  const { files, fetchFiles, uploadFile, deleteFile } = useFileStore()
  const { projects, fetchProjects } = useProjectStore()

  const [showNewDoc, setShowNewDoc] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocType, setNewDocType] = useState('markdown')
  const [newDocProject, setNewDocProject] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchDocuments()
    fetchFolders()
    fetchFiles()
    fetchProjects()
  }, [])

  const filteredDocs = documents.filter(d => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || d.title.toLowerCase().includes(q)
    const matchFolder = !selectedFolderId // Folders are localStorage-based, docs don't have folder_id in DB
    const matchProject = !selectedProjectId || d.project_id === selectedProjectId
    return matchSearch && matchFolder && matchProject
  })

  const filteredFiles = files.filter(f => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q || f.name.toLowerCase().includes(q)
    const matchProject = !selectedProjectId || f.project_id === selectedProjectId
    return matchSearch && matchProject
  })

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim()) { toast.error('请输入文档标题'); return }
    await createDocument({
      title: newDocTitle.trim(),
      type: newDocType,
      project_id: newDocProject || undefined,
    })
    setShowNewDoc(false)
    setNewDocTitle('')
    setNewDocType('markdown')
    setNewDocProject('')
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { toast.error('请输入文件夹名称'); return }
    await createFolder(newFolderName.trim(), selectedFolderId || undefined)
    setShowNewFolder(false)
    setNewFolderName('')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file, selectedProjectId || undefined)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文档中心</h1>
          <p className="text-muted-foreground">统一管理所有项目文档和资料</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNewFolder(true)}>
            <FolderOpen className="h-4 w-4" /> 新建文件夹
          </Button>
          <Button size="sm" className="gap-2 btn-press" onClick={() => setShowNewDoc(true)}>
            <Plus className="h-4 w-4" /> 新建文档
          </Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar: Folder Tree + Project Filter */}
        <div className="w-52 shrink-0 space-y-4">
          {/* Folders (localStorage-based) */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 mb-1">文件夹</h3>
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${!selectedFolderId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
              onClick={() => setSelectedFolder(null)}
            >
              <FolderOpen className="h-4 w-4" /> 全部文档
            </div>
            {folders.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors group ${selectedFolderId === f.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
                onClick={() => setSelectedFolder(f.id)}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 truncate">{f.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); useDocumentStore.getState().deleteFolder(f.id) }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Project Filter */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 mb-1">按项目筛选</h3>
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${!selectedProjectId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
              onClick={() => { setSelectedProject(null); fetchDocuments() }}
            >
              <FolderOpen className="h-4 w-4" /> 全部项目
            </div>
            {projects.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${selectedProjectId === p.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
                onClick={() => { setSelectedProject(p.id); fetchDocuments(p.id) }}
              >
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
                <span className="flex-1 truncate">{p.name}</span>
                <Badge variant="secondary" className="text-xs">{p.task_count || 0}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Search + Upload */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索文档..."
                className="pl-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> 上传文件
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </div>

          {/* Documents Grid */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : (
            <>
              {filteredDocs.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDocs.map((doc) => (
                    <Card key={doc.id} className="card-glow cursor-pointer hover:border-primary/30 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            {docTypeIcon[doc.type || 'markdown'] || <FileText className="h-5 w-5 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold leading-snug">
                              {doc.title}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {doc.type || 'markdown'} · {new Date(doc.updated_at).toLocaleDateString('zh-CN')}
                              {doc.project_name && ` · ${doc.project_name}`}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2">
                          {doc.project_name && (
                            <Badge variant="secondary" className="text-xs">{doc.project_name}</Badge>
                          )}
                          {doc.task_name && (
                            <Badge variant="outline" className="text-xs">{doc.task_name}</Badge>
                          )}
                          <div className="ml-auto flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id) }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Files List */}
              {filteredFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">附件文件</h3>
                  <div className="space-y-2">
                    {filteredFiles.map(f => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name)
                      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(f.name)
                      const isDoc = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md)$/i.test(f.name)
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => f.public_url && setPreviewFile({ url: f.public_url, name: f.name })}
                        >
                          {isImage ? <Image className="h-5 w-5 text-blue-400 shrink-0" /> :
                           isVideo ? <Film className="h-5 w-5 text-purple-400 shrink-0" /> :
                           isDoc ? <FileText className="h-5 w-5 text-amber-400 shrink-0" /> :
                           <File className="h-5 w-5 text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(f.file_size || 0 / 1024).toFixed(1)} KB · {new Date(f.created_at).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteFile(f.id) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {filteredDocs.length === 0 && filteredFiles.length === 0 && (
                <div className="text-center py-16">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30" />
                  <p className="mt-3 text-muted-foreground">暂无文档，点击上方按钮创建</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Document Dialog */}
      <Dialog open={showNewDoc} onOpenChange={setShowNewDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文档</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>文档标题</Label>
              <Input
                className="mt-1"
                placeholder="输入文档标题"
                value={newDocTitle}
                onChange={e => setNewDocTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateDoc()}
              />
            </div>
            <div>
              <Label>文档类型</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['markdown', 'richtext', 'code', 'note', 'PRD', 'API', '报告', '周报'].map(t => (
                  <Badge
                    key={t}
                    variant={newDocType === t ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setNewDocType(t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>关联项目</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newDocProject}
                onChange={e => setNewDocProject(e.target.value)}
              >
                <option value="">无项目</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewDoc(false)}>取消</Button>
              <Button onClick={handleCreateDoc}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>文件夹名称</Label>
              <Input
                className="mt-1"
                placeholder="输入文件夹名称"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewFolder(false)}>取消</Button>
              <Button onClick={handleCreateFolder}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile && <FilePreview url={previewFile.url} name={previewFile.name} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
