'use client'

import { useEffect, useState, useRef } from 'react'
import { MessageSquare, Send, Users, Plus, Hash, X, Lock, MoreHorizontal, Trash2, Edit2, UserPlus, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useCollaborationStore, type Message, type Channel } from '@/lib/store/collaboration-store'
import { toast } from 'sonner'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg, isOwn, onEdit, onDelete }: { msg: Message; isOwn: boolean; onEdit: () => void; onDelete: () => void }) {
  const avatar = msg.profile?.avatar_url
  const name = msg.profile?.full_name || msg.profile?.username || msg.sender_name || '未知'
  const initials = name[0]?.toUpperCase() || '?'

  if (msg.message_type === 'image' && msg.file_url) {
    return (
      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <Avatar className="h-7 w-7 mt-0.5 shrink-0">
          {avatar ? <AvatarImage src={avatar} /> : <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>}
        </Avatar>
        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{name}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
          </div>
          <img src={msg.file_url} alt={msg.file_name || '图片'} className="max-w-xs max-h-64 rounded-lg object-contain" />
        </div>
      </div>
    )
  }

  if (msg.message_type === 'file' && msg.file_url) {
    return (
      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <Avatar className="h-7 w-7 mt-0.5 shrink-0">
          {avatar ? <AvatarImage src={avatar} /> : <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>}
        </Avatar>
        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{name}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
          </div>
          <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
            <span>{msg.file_name || msg.content}</span>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <Avatar className="h-7 w-7 mt-0.5 shrink-0">
        {avatar ? <AvatarImage src={avatar} /> : <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>}
      </Avatar>
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1 group relative`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{name}</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
          {msg.content}
          {msg.is_edited && <span className="text-[10px] opacity-60 ml-1">(已编辑)</span>}
        </div>
        {isOwn && (
          <div className="absolute -right-16 top-0 hidden group-hover:flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CollaborationPage() {
  const {
    channels, messages, activeChannelId, loading, channelMembers,
    fetchChannels, fetchMessages, sendMessage, sendFileMessage, deleteMessage, updateMessage,
    createChannel, deleteChannel, setActiveChannel, subscribeToMessages, unsubscribeFromChannel,
    fetchChannelMembers, inviteUser, removeMember,
  } = useCollaborationStore()

  const [inputValue, setInputValue] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [newChannelPrivate, setNewChannelPrivate] = useState(false)
  const [editingMsg, setEditingMsg] = useState<{ id: string; content: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // get current user id
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id || null)
      })
    })
  }, [])

  useEffect(() => {
    fetchChannels()
  }, [])

  // Subscribe to realtime messages when active channel changes
  useEffect(() => {
    if (!activeChannelId) return
    subscribeToMessages(activeChannelId)
    return () => unsubscribeFromChannel(activeChannelId)
  }, [activeChannelId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages[activeChannelId || '']])

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const channelMessages = (activeChannelId ? messages[activeChannelId] : []) || []
  const members = (activeChannelId ? channelMembers[activeChannelId] : []) || []

  const handleSend = async () => {
    if (!inputValue.trim() || !activeChannelId) return
    const content = inputValue.trim()
    setInputValue('')
    try {
      await sendMessage(activeChannelId, content)
    } catch {
      setInputValue(content) // restore on failure
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChannelId) return
    try {
      // Upload to file store first
      const { useFileStore } = await import('@/lib/store/file-store')
      const uploaded = await useFileStore.getState().uploadFile(file)
      if (uploaded?.public_url) {
        await sendFileMessage(activeChannelId, uploaded.public_url, file.name)
      }
    } catch {
      toast.error('文件上传失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) { toast.error('请输入频道名称'); return }
    await createChannel(newChannelName.trim(), newChannelDesc.trim(), newChannelPrivate)
    setShowNewChannel(false)
    setNewChannelName('')
    setNewChannelDesc('')
    setNewChannelPrivate(false)
  }

  const handleDeleteMessage = async (id: string) => {
    if (!activeChannelId) return
    await deleteMessage(id, activeChannelId)
  }

  const handleEditMessage = async () => {
    if (!editingMsg || !activeChannelId) return
    await updateMessage(editingMsg.id, activeChannelId, editingMsg.content)
    setEditingMsg(null)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeChannelId) return
    await inviteUser(activeChannelId, inviteEmail.trim())
    setInviteEmail('')
    setShowInvite(false)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!activeChannelId) return
    if (!confirm('确定要移除该成员吗？')) return
    await removeMember(activeChannelId, memberId)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Channel List */}
      <div className="w-64 shrink-0 space-y-1">
        <div className="flex items-center justify-between px-2 py-2">
          <h2 className="text-sm font-semibold">频道</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewChannel(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-xs">加载中...</div>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${activeChannelId === ch.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'}`}
              onClick={() => setActiveChannel(ch.id)}
            >
              {ch.is_private ? <Lock className="h-3 w-3 shrink-0" /> : <Hash className="h-3 w-3 shrink-0" />}
              <span className="flex-1 truncate">{ch.name}</span>
            </div>
          ))
        )}
        {channels.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground px-3">暂无频道</p>
        )}
      </div>

      {/* Chat Area */}
      {activeChannelId && activeChannel ? (
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 border-b shrink-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {activeChannel.is_private ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
              {activeChannel.name}
              {activeChannel.description && <span className="text-sm font-normal text-muted-foreground">· {activeChannel.description}</span>}
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => { setShowMembers(true); fetchChannelMembers(activeChannelId) }}
                >
                  <Users className="h-3 w-3" />
                  {members.length || '—'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setShowInvite(true)}
                >
                  <UserPlus className="h-3 w-3" />
                  邀请
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => { deleteChannel(activeChannelId); setActiveChannel(null) }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 flex flex-col justify-end p-4 overflow-y-auto space-y-4 min-h-0">
            {channelMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">暂无消息，发送第一条消息吧！</div>
            )}
            {channelMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_id === currentUserId}
                onEdit={() => setEditingMsg({ id: msg.id, content: msg.content })}
                onDelete={() => handleDeleteMessage(msg.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-3 border-t shrink-0 flex gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
              <Plus className="h-4 w-4" />
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            <Input
              ref={inputRef}
              placeholder="输入消息，按 Enter 发送..."
              className="flex-1"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
            />
            <Button size="icon" className="shrink-0" onClick={handleSend} disabled={!inputValue.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex-1 flex flex-col items-center justify-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">选择一个频道开始聊天</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowNewChannel(true)}>
            <Plus className="h-4 w-4" /> 创建频道
          </Button>
        </Card>
      )}

      {/* Create Channel Dialog */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建频道</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>频道名称 *</Label><Input className="mt-1" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="如：general" onKeyDown={e => e.key === 'Enter' && handleCreateChannel()} /></div>
            <div><Label>描述</Label><Input className="mt-1" value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="频道简介（可选）" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={newChannelPrivate} onChange={e => setNewChannelPrivate(e.target.checked)} className="rounded" />
              私有频道（仅成员可见）
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewChannel(false)}>取消</Button>
              <Button onClick={handleCreateChannel}>创建</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingMsg} onOpenChange={() => setEditingMsg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑消息</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={editingMsg?.content || ''} onChange={e => setEditingMsg(prev => prev ? { ...prev, content: e.target.value } : null)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingMsg(null)}>取消</Button>
              <Button onClick={handleEditMessage}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>邀请用户加入频道</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>用户邮箱</Label>
              <Input
                className="mt-1"
                placeholder="输入用户注册邮箱"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              输入已注册用户的邮箱地址，邀请其加入「{activeChannel?.name}」频道
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowInvite(false)}>取消</Button>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>发送邀请</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Members Dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent>
          <DialogHeader><DialogTitle>频道成员 — {activeChannel?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                暂无成员，点击「邀请」添加成员
              </div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Avatar className="h-8 w-8">
                    {m.avatar_url ? <AvatarImage src={m.avatar_url} /> : (
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {(m.full_name || m.username || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || m.username || '成员'}</p>
                    {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs">{m.role || 'member'}</Badge>
                  {m.user_id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => handleRemoveMember(m.id)}
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> 邀请成员
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
