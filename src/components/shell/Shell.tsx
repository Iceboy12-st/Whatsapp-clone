import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Send, Smile, Paperclip, ArrowLeft, MoveVertical as MoreVertical, Search, X, MessageSquarePlus, LogOut, Settings as SettingsIcon, Pin, BellOff, Check, Phone, Video, Users, CircleDot, Archive, Star, MessageCircle, Lock, Camera } from 'lucide-react'
import clsx from 'clsx'
import { useAuth, useMe } from '@/context/AuthContext'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useMessages, type SendInput } from '@/hooks/useMessages'
import { sendTyping } from '@/hooks/useRealtimeSync'
import { useChats, sortChats } from '@/store/chats'
import { useUI, type LeftView } from '@/store/ui'
import { usePrefs, WALLPAPERS, type ThemePref, type WallpaperId } from '@/store/prefs'
import { usePresence } from '@/store/presence'
import { useIsMobile } from '@/hooks/useTheme'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarPicker } from '@/components/ui/AvatarPicker'
import { IconButton, Menu, Spinner, Toggle, RowSkeleton, EmptyNote } from '@/components/ui/primitives'
import { supabase } from '@/lib/supabase'
import { getSignedUrl } from '@/lib/storage'
import { toastError } from '@/store/toast'
import {
  chatTitle, chatAvatar, formatMessageTime, formatConversationTime, formatChatDate,
  getDisplayName, splitLinks, getSenderColor, isMuted, messagePreview,
} from '@/lib/utils'
import type { ChatItem, UIMessage, Profile, Message } from '@/types'

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function Shell({ me }: { me: Profile }) {
  useRealtimeSync(me)
  const { activeChatId, leftView, setLeftView, openChat, call, setCall } = useUI()
  const { chats, loaded } = useChats()
  const isMobile = useIsMobile()

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null

  const showLeftPanel = !isMobile || (!activeChatId && leftView !== 'settings' && leftView !== 'profile')
  const showRightPanel = !isMobile || activeChatId

  return (
    <div className="flex h-full overflow-hidden bg-app">
      {showLeftPanel && <LeftPanel me={me} />}
      {showRightPanel && (
        activeChat ? (
          <ConversationView key={activeChat.id} chat={activeChat} me={me} />
        ) : (
          <WelcomeScreen />
        )
      )}
      {call && <CallOverlay chatId={call.chatId} video={call.video} onClose={() => setCall(null)} />}
    </div>
  )

  function LeftPanel({ me }: { me: Profile }) {
    return (
      <div className="flex h-full w-full min-w-[380px] max-w-[420%] shrink-0 border-r border-line md:w-[30%] md:min-w-[340px] md:max-w-[460px]">
        <IconRail me={me} />
        <div className="flex min-w-0 flex-1 flex-col">
          {leftView === 'chats' && <ChatListPanel />}
          {leftView === 'new-chat' && <NewChatPanel />}
          {leftView === 'new-group' && <NewGroupPanel me={me} />}
          {leftView === 'archived' && <ArchivedPanel />}
          {leftView === 'starred' && <StarredPanel me={me} />}
          {leftView === 'status' && <StatusPanel me={me} />}
          {leftView === 'communities' && <CommunitiesPanel me={me} />}
          {leftView === 'settings' && <SettingsPanel me={me} />}
          {leftView === 'profile' && <ProfilePanel me={me} />}
        </div>
      </div>
    )
  }
}

function IconRail({ me }: { me: Profile }) {
  const { leftView, setLeftView, openChat } = useUI()
  const items: { view: LeftView; icon: typeof MessageCircle; label: string }[] = [
    { view: 'chats', icon: MessageCircle, label: 'Chats' },
    { view: 'status', icon: CircleDot, label: 'Status' },
    { view: 'communities', icon: Users, label: 'Communities' },
    { view: 'archived', icon: Archive, label: 'Archived' },
    { view: 'starred', icon: Star, label: 'Starred' },
  ]

  return (
    <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2 md:flex">
      {items.map((item) => {
        const active = leftView === item.view && !useUI.getState().activeChatId
        const Icon = item.icon
        return (
          <button
            key={item.view}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => { setLeftView(item.view); openChat(null) }}
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
              active ? 'bg-black/10 text-accent dark:bg-white/10' : 'text-ink-2 hover:bg-black/5 dark:hover:bg-white/10',
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} />
          </button>
        )
      })}
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        onClick={() => { setLeftView('settings'); openChat(null) }}
        className={clsx(
          'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
          leftView === 'settings' ? 'bg-black/10 text-accent dark:bg-white/10' : 'text-ink-2 hover:bg-black/5 dark:hover:bg-white/10',
        )}
      >
        <SettingsIcon className="h-6 w-6" strokeWidth={1.8} />
      </button>
      <button type="button" aria-label="Profile" title="Profile" onClick={() => { setLeftView('profile'); openChat(null) }} className="mb-1 mt-1">
        <Avatar src={me.avatar_url} name={getDisplayName(me)} size={40} />
      </button>
    </nav>
  )
}

function ChatListPanel() {
  const { profile, signOut } = useAuth()
  const { chats, loaded } = useChats()
  const { activeChatId, openChat, setLeftView, listSearchFocusTick } = useUI()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all')

  const visible = useMemo(() => {
    let list = chats.filter((c) => !c.me.is_hidden && !c.me.is_archived)
    if (filter === 'unread') list = list.filter((c) => c.unread_count > 0)
    if (filter === 'groups') list = list.filter((c) => c.is_group)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => chatTitle(c).toLowerCase().includes(q) || messagePreview(c.last_message).toLowerCase().includes(q))
    }
    return sortChats(list)
  }, [chats, filter, search])

  useEffect(() => {
    if (listSearchFocusTick > 0) {
      const el = document.getElementById('chat-search') as HTMLInputElement | null
      el?.focus()
    }
  }, [listSearchFocusTick])

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[48px] shrink-0 items-center justify-between px-4 md:h-[59px]">
        <h1 className="text-[22px] font-bold text-ink">Chats</h1>
        <div className="flex items-center gap-1">
          <IconButton label="New chat" onClick={() => setLeftView('new-chat')}>
            <MessageSquarePlus className="h-5 w-5" />
          </IconButton>
          <Menu
            items={[
              { label: 'New group', onSelect: () => setLeftView('new-group'), icon: <Users className="h-4 w-4" /> },
              { label: 'Settings', onSelect: () => setLeftView('settings'), icon: <SettingsIcon className="h-4 w-4" /> },
              { label: 'Log out', onSelect: () => void signOut(), danger: true, icon: <LogOut className="h-4 w-4" /> },
            ]}
            trigger={(p) => (
              <IconButton label="Menu" ref={p.ref} onClick={p.toggle} active={p.open}>
                <MoreVertical className="h-5 w-5" />
              </IconButton>
            )}
          />
        </div>
      </header>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            id="chat-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full rounded-lg bg-field py-2 pl-10 pr-8 text-[14px] text-ink outline-none focus:ring-2 focus:ring-accent/30"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-3 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-3 pb-2">
        {(['all', 'unread', 'groups'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={clsx('rounded-full px-3 py-1 text-[13px] capitalize transition-colors', filter === f ? 'bg-accent-soft text-accent' : 'bg-field text-ink-2 hover:bg-hover')}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!loaded ? (
          <RowSkeleton />
        ) : visible.length === 0 ? (
          <EmptyNote icon={<MessageSquarePlus className="h-10 w-10" />} title="No chats yet" body="Start a new conversation" />
        ) : (
          visible.map((chat) => <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} meId={profile?.id ?? ''} onClick={() => openChat(chat.id)} />)
        )}
      </div>
    </div>
  )
}

function ChatRow({ chat, active, meId, onClick }: { chat: ChatItem; active: boolean; meId: string; onClick: () => void }) {
  const title = chatTitle(chat)
  const avatar = chatAvatar(chat)
  const isMine = chat.last_message?.sender_id === meId
  const muted = isMuted(chat)

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('flex w-full items-center gap-3 px-3 py-3 text-left transition-colors', active ? 'bg-active' : 'hover:bg-hover')}
    >
      <Avatar src={avatar} name={title} size={49} group={chat.is_group} />
      <div className="min-w-0 flex-1 border-b border-line pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[16px] font-medium text-ink">{title}</span>
          <span className={clsx('shrink-0 text-[12px]', chat.unread_count > 0 ? 'text-accent' : 'text-ink-3')}>
            {chat.last_message ? formatConversationTime(chat.last_message.created_at) : ''}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 text-[14px] text-ink-2">
            {isMine && !chat.last_message?.deleted_for_everyone && <span className="shrink-0">You: </span>}
            <span className="truncate">{messagePreview(chat.last_message) || 'Tap to start chatting'}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {muted && <BellOff className="h-4 w-4 text-ink-3" />}
            {chat.me.is_pinned && <Pin className="h-3.5 w-3.5 text-ink-3" />}
            {chat.unread_count > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                {chat.unread_count > 99 ? '99+' : chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function WelcomeScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center border-l border-line bg-panel px-8 text-center">
      <div className="max-w-md">
        <div className="mb-6 flex h-48 w-48 items-center justify-center rounded-full bg-app">
          <MessageCircle className="h-20 w-20 text-ink-3" strokeWidth={1} />
        </div>
        <h1 className="text-[28px] font-light text-ink">WhatsApp Web</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Send and receive messages without keeping your phone online. Select a chat to start messaging.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-line pt-4 text-xs text-ink-3">
          <Lock className="h-3.5 w-3.5" />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>
      </div>
    </div>
  )
}

function ConversationView({ chat, me }: { chat: ChatItem; me: Profile }) {
  const { openChat, setCall, rightPanel, setRightPanel } = useUI()
  const prefs = usePrefs()
  const {
    messages, loading, loadingOlder, hasMore, loadOlder,
    send, deleteForMe, deleteForEveryone, react, edit, retry, discard, error,
  } = useMessages(chat, me.id, true)

  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<UIMessage | null>(null)
  const [editing, setEditing] = useState<UIMessage | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const typingTimer = useRef<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const title = chatTitle(chat)
  const avatar = chatAvatar(chat)
  const subtitle = chat.is_group ? `${chat.members.length} members` : chat.other?.about ?? 'online'

  useEffect(() => { endRef.current?.scrollIntoView() }, [chat.id])
  useEffect(() => { if (atBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length, atBottom])

  function onScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  function handleSend() {
    if (editing) {
      if (input.trim()) void edit(editing, input.trim())
      setEditing(null); setInput(''); return
    }
    if (!input.trim()) return
    send({ text: input.trim(), replyToId: replyTo?.id ?? null })
    setInput(''); setReplyTo(null)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && prefs.enterToSend) { e.preventDefault(); handleSend() }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    sendTyping(chat.id, me.id, true)
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => sendTyping(chat.id, me.id, false), 2500)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { send({ text: '', file, fileName: file.name }); if (fileRef.current) fileRef.current.value = '' }
  }

  const grouped = groupByDate(messages)

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex h-[48px] shrink-0 items-center gap-3 bg-header px-4 py-2 md:h-[59px]">
        <button type="button" aria-label="Back" className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10 md:hidden" onClick={() => openChat(null)}>
          <ArrowLeft className="h-5 w-5 text-ink-2" />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setRightPanel(rightPanel === 'info' ? null : 'info')}>
          <Avatar src={avatar} name={title} size={40} group={chat.is_group} />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-medium text-ink">{title}</div>
            <div className="truncate text-[12px] text-ink-2">{subtitle}</div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {!chat.is_group && (
            <>
              <IconButton label="Video call" onClick={() => setCall({ chatId: chat.id, video: true })}><Video className="h-5 w-5" /></IconButton>
              <IconButton label="Voice call" onClick={() => setCall({ chatId: chat.id, video: false })}><Phone className="h-5 w-5" /></IconButton>
            </>
          )}
          <IconButton label="Search" onClick={() => setRightPanel('search')}><Search className="h-5 w-5" /></IconButton>
          <Menu
            items={[
              { label: 'Contact info', onSelect: () => setRightPanel('info') },
              { label: 'Clear messages', onSelect: () => { void deleteForMe(messages.filter(m => !m.localStatus)) }, danger: true },
            ]}
            trigger={(p) => <IconButton label="Menu" ref={p.ref} onClick={p.toggle} active={p.open}><MoreVertical className="h-5 w-5" /></IconButton>}
          />
        </div>
      </header>

      <div className={clsx('wallpaper flex-1 overflow-y-auto px-4 py-2 md:px-[8%]', prefs.doodles && 'doodles')} ref={scrollRef} onScroll={onScroll}>
        {loading ? (
          <div className="flex h-full items-center justify-center"><Spinner /></div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-center"><p className="text-sm text-danger">{error}</p></div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-accent/10 p-4"><Smile className="h-8 w-8 text-accent" /></div>
            <p className="text-sm text-ink-2">No messages yet. Say hello to {title}!</p>
          </div>
        ) : (
          <div className="mx-auto max-w-[900px] space-y-0.5">
            {hasMore && (
              <div className="flex justify-center py-2">
                <button type="button" onClick={() => void loadOlder()} className="rounded-full bg-panel/80 px-4 py-1.5 text-[12px] text-accent shadow-sm hover:bg-panel">
                  {loadingOlder ? 'Loading…' : 'Load older'}
                </button>
              </div>
            )}
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-panel/80 px-3 py-1 text-[12px] text-ink-2 shadow-sm">{formatChatDate(group.date)}</span>
                </div>
                {group.items.map((msg, i) => {
                  const isMine = msg.sender_id === me.id
                  const prev = i > 0 ? group.items[i - 1] : null
                  const next = i < group.items.length - 1 ? group.items[i + 1] : null
                  const isFirst = !prev || prev.sender_id !== msg.sender_id
                  const isLast = !next || next.sender_id !== msg.sender_id
                  const senderName = chat.members.find(m => m.profile.id === msg.sender_id)?.profile
                    ? getDisplayName(chat.members.find(m => m.profile.id === msg.sender_id)!.profile) : 'Unknown'
                  return (
                    <MessageBubble
                      key={msg.client_id ?? msg.id}
                      msg={msg} isMine={isMine} isFirst={isFirst} isLast={isLast}
                      isGroup={chat.is_group} senderName={senderName} senderId={msg.sender_id}
                      onReply={() => setReplyTo(msg)}
                      onEdit={() => { setEditing(msg); setInput(msg.content) }}
                      onDeleteMe={() => void deleteForMe([msg])}
                      onDeleteAll={() => void deleteForEveryone([msg])}
                      onRetry={() => retry(msg)}
                      onDiscard={() => discard(msg)}
                      onReact={(e: string) => void react(msg, e)}
                    />
                  )
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 bg-panel px-4 py-2 text-sm">
          <div className="flex-1 border-l-2 border-accent pl-2">
            <span className="text-accent">Replying to {replyTo.sender_id === me.id ? 'yourself' : title}</span>
            <p className="truncate text-ink-2">{replyTo.content || '[Media]'}</p>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} className="rounded-full p-1 text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      )}
      {editing && (
        <div className="flex items-center gap-2 bg-panel px-4 py-2 text-sm">
          <span className="text-accent">Editing</span>
          <button type="button" onClick={() => { setEditing(null); setInput('') }} className="ml-auto rounded-full px-3 py-1 text-ink-2 hover:bg-hover">Cancel</button>
        </div>
      )}

      <div className="flex items-end gap-2 bg-panel px-4 py-3">
        <IconButton label="Attach" onClick={() => fileRef.current?.click()}><Paperclip className="h-6 w-6" /></IconButton>
        <input ref={fileRef} type="file" hidden onChange={onFile} />
        <textarea
          value={input} onChange={onInput} onKeyDown={onKeyDown}
          placeholder={editing ? 'Edit message' : 'Type a message'}
          rows={1}
          className="flex-1 resize-none rounded-3xl bg-field px-4 py-2.5 text-[15px] text-ink outline-none focus:ring-2 focus:ring-accent/20"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
          type="button" onClick={handleSend}
          disabled={!input.trim() && !editing}
          className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors', input.trim() || editing ? 'bg-accent text-white hover:bg-accent-dark' : 'bg-field text-ink-3')}
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>

      {rightPanel === 'info' && <InfoPanel chat={chat} me={me} />}
    </div>
  )
}

function groupByDate(messages: UIMessage[]): { date: string; items: UIMessage[] }[] {
  const groups: { date: string; items: UIMessage[] }[] = []
  for (const msg of messages) {
    const key = new Date(msg.created_at).toDateString()
    const last = groups[groups.length - 1]
    if (last && last.date === key) last.items.push(msg)
    else groups.push({ date: key, items: [msg] })
  }
  return groups
}

function MessageBubble({
  msg, isMine, isFirst, isLast, isGroup, senderName, senderId,
  onReply, onEdit, onDeleteMe, onDeleteAll, onRetry, onDiscard, onReact,
}: {
  msg: UIMessage; isMine: boolean; isFirst: boolean; isLast: boolean; isGroup: boolean
  senderName: string; senderId: string
  onReply: () => void; onEdit: () => void; onDeleteMe: () => void; onDeleteAll: () => void
  onRetry: () => void; onDiscard: () => void; onReact: (emoji: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)

  useEffect(() => {
    if (msg.media_url && !msg.localUrl) void getSignedUrl(msg.media_url).then(setMediaUrl)
    else if (msg.localUrl) setMediaUrl(msg.localUrl)
  }, [msg.media_url, msg.localUrl])

  if (msg.type === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-lg bg-panel/80 px-3 py-1 text-[12px] text-ink-2 shadow-sm">{msg.content}</span>
      </div>
    )
  }

  return (
    <div className={clsx('flex group', isMine ? 'justify-end' : 'justify-start', isLast ? 'mb-1.5' : 'mb-0.5')} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="relative max-w-[75%] md:max-w-[60%]">
        <div className={clsx('relative rounded-lg px-3 py-2 text-[15px] shadow-bubble', isMine ? 'bg-bubble-out text-ink' : 'bg-bubble-in text-ink', isFirst && isMine && 'rounded-tr-none', isFirst && !isMine && 'rounded-tl-none')}>
          {!isMine && isGroup && isFirst && <div className="mb-0.5 text-[13px] font-medium" style={{ color: getSenderColor(senderId) }}>{senderName}</div>}
          {msg.deleted_for_everyone ? (
            <p className="italic text-ink-3">This message was deleted</p>
          ) : msg.type === 'image' && mediaUrl ? (
            <img src={mediaUrl} alt={msg.content || 'Photo'} className="max-h-80 max-w-full rounded-lg" />
          ) : msg.type === 'video' && mediaUrl ? (
            <video src={mediaUrl} controls className="max-h-80 max-w-full rounded-lg" />
          ) : msg.type === 'audio' && mediaUrl ? (
            <audio src={mediaUrl} controls className="w-60" />
          ) : msg.type === 'document' && mediaUrl ? (
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">{msg.media_name || 'Document'}</a>
          ) : (
            <div className="whitespace-pre-wrap break-words leading-[1.4]">
              {splitLinks(msg.content).map((p, i) => p.href ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{p.text}</a> : <span key={i}>{p.text}</span>)}
            </div>
          )}
          {msg.edited_at && !msg.deleted_for_everyone && <span className="mr-1 text-[11px] text-ink-3">edited</span>}
          <span className="float-right ml-2 mt-1 text-[11px] text-ink-3">
            {formatMessageTime(msg.created_at)}
            {isMine && !msg.deleted_for_everyone && (msg.localStatus === 'pending' ? ' ⏱' : msg.localStatus === 'failed' ? ' ✗' : <Check className="ml-0.5 inline h-3.5 w-3.5" />)}
          </span>
        </div>

        {hover && !msg.deleted_for_everyone && (
          <div className={clsx('absolute top-0 z-10', isMine ? 'right-full mr-1' : 'left-full ml-1')}>
            <button type="button" onClick={() => setShowMenu(!showMenu)} className="flex h-7 w-7 items-center justify-center rounded-full bg-panel shadow-md" aria-label="Actions">
              <MoreVertical className="h-4 w-4 text-ink-2" />
            </button>
          </div>
        )}

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className={clsx('absolute z-20 mt-8 min-w-[160px] rounded-md bg-panel py-1 shadow-menu', isMine ? 'right-0' : 'left-0')}>
              <button type="button" onClick={() => { onReply(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Reply</button>
              {isMine && !msg.deleted_for_everyone && msg.type === 'text' && <button type="button" onClick={() => { onEdit(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Edit</button>}
              <div className="my-1 border-t border-line" />
              <div className="flex gap-1 px-3 py-1">{QUICK_EMOJI.map((e) => <button key={e} type="button" onClick={() => { onReact(e); setShowMenu(false) }} className="text-lg hover:scale-125 transition-transform">{e}</button>)}</div>
              <div className="my-1 border-t border-line" />
              {msg.localStatus === 'failed' ? (
                <>
                  <button type="button" onClick={() => { onRetry(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm hover:bg-hover">Retry</button>
                  <button type="button" onClick={() => { onDiscard(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-hover">Discard</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { onDeleteMe(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-hover">Delete for me</button>
                  {isMine && <button type="button" onClick={() => { onDeleteAll(); setShowMenu(false) }} className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-hover">Delete for everyone</button>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoPanel({ chat, me }: { chat: ChatItem; me: Profile }) {
  const { setRightPanel } = useUI()
  return (
    <div className="fixed right-0 top-0 z-30 h-full w-full max-w-[400px] animate-slide-in border-l border-line bg-panel md:w-[380px]">
      <header className="flex h-[48px] items-center gap-4 bg-header px-4 md:h-[59px]">
        <IconButton label="Close" onClick={() => setRightPanel(null)}><X className="h-5 w-5" /></IconButton>
        <h2 className="text-[16px] font-medium text-ink">{chat.is_group ? 'Group info' : 'Contact info'}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center gap-3">
          <Avatar src={chatAvatar(chat)} name={chatTitle(chat)} size={200} group={chat.is_group} />
          <h3 className="text-[24px] font-light text-ink">{chatTitle(chat)}</h3>
          {!chat.is_group && chat.other && <p className="text-sm text-ink-2">{chat.other.about}</p>}
          {chat.is_group && <p className="text-sm text-ink-2">{chat.members.length} members</p>}
        </div>
        {chat.is_group && (
          <div className="mt-6">
            <h4 className="mb-2 text-[14px] font-medium text-ink-2">Members</h4>
            {chat.members.map((m) => (
              <div key={m.profile.id} className="flex items-center gap-3 py-2">
                <Avatar src={m.profile.avatar_url} name={getDisplayName(m.profile)} size={40} />
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[15px] text-ink">{getDisplayName(m.profile)}</span>
                  {m.role === 'admin' && <span className="ml-2 text-[12px] text-accent">admin</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewChatPanel() {
  const { user } = useAuth()
  const { openChat, setLeftView } = useUI()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim() || !user) { setResults([]); return }
      setLoading(true)
      const { data, error } = await supabase.from('profiles').select('*').neq('id', user.id).or(`display_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`).limit(20)
      if (error) toastError(error)
      setResults((data ?? []) as Profile[]); setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, user])

  async function startChat(otherId: string) {
    setCreating(otherId)
    const { data, error } = await supabase.rpc('create_direct_chat', { other: otherId })
    if (error) { toastError(error); setCreating(null); return }
    if (data) { openChat(data as string); setLeftView('chats') }
    setCreating(null)
  }

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">New chat</h1>
      </header>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email" autoFocus className="w-full rounded-lg bg-field py-2.5 pl-10 pr-4 text-[14px] text-ink outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="flex justify-center py-10"><Spinner /></div>
        : results.length === 0 ? <EmptyNote icon={<Search className="h-10 w-10" />} title={search.trim() ? 'No users found' : 'Search to start a chat'} />
        : results.map((p) => (
          <button key={p.id} type="button" onClick={() => void startChat(p.id)} disabled={creating !== null} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover disabled:opacity-50">
            <Avatar src={p.avatar_url} name={getDisplayName(p)} size={49} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[16px] font-medium text-ink">{getDisplayName(p)}</div>
              <div className="truncate text-[14px] text-ink-2">{p.about}</div>
            </div>
            {creating === p.id && <Spinner className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function NewGroupPanel({ me }: { me: Profile }) {
  const { openChat, setLeftView } = useUI()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!search.trim() || !user) { setResults([]); return }
      const { data } = await supabase.from('profiles').select('*').neq('id', user.id).or(`display_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`).limit(20)
      setResults((data ?? []) as Profile[])
    }, 300)
    return () => clearTimeout(t)
  }, [search, user])

  async function create() {
    if (!name.trim() || selected.size === 0) return
    setCreating(true)
    const { data, error } = await supabase.rpc('create_group_chat', { _name: name.trim(), member_ids: [...selected] })
    if (error) { toastError(error); setCreating(false); return }
    if (data) { openChat(data as string); setLeftView('chats') }
    setCreating(false)
  }

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">New group</h1>
      </header>
      <div className="p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={100} className="w-full rounded-lg border border-line bg-field px-4 py-2.5 text-[15px] text-ink outline-none focus:ring-2 focus:ring-accent/30" />
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {[...selected].map((id) => {
            const p = results.find((r) => r.id === id)
            return p ? (
              <span key={id} className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-[13px] text-accent">
                {getDisplayName(p)}
                <button type="button" onClick={() => setSelected((s) => { const n = new Set(s); n.delete(id); return n })}><X className="h-3 w-3" /></button>
              </span>
            ) : null
          })}
        </div>
      )}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts to add" className="w-full rounded-lg bg-field py-2 pl-10 pr-4 text-[14px] text-ink outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.map((p) => {
          const isSelected = selected.has(p.id)
          return (
            <button key={p.id} type="button" onClick={() => setSelected((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover">
              <Avatar src={p.avatar_url} name={getDisplayName(p)} size={44} />
              <span className="flex-1 truncate text-[15px] text-ink">{getDisplayName(p)}</span>
              <span className={clsx('h-5 w-5 rounded-full border-2', isSelected ? 'border-accent bg-accent' : 'border-line')} />
            </button>
          )
        })}
      </div>
      <div className="border-t border-line p-4">
        <button type="button" onClick={() => void create()} disabled={!name.trim() || selected.size === 0 || creating} className="w-full rounded-full bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50">
          {creating ? 'Creating…' : `Create group (${selected.size})`}
        </button>
      </div>
    </div>
  )
}

function ArchivedPanel() {
  const { chats, loaded } = useChats()
  const { activeChatId, openChat, setLeftView } = useUI()
  const archived = sortChats(chats.filter((c) => c.me.is_archived && !c.me.is_hidden))

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Archived</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {!loaded ? <RowSkeleton /> : archived.length === 0 ? <EmptyNote icon={<Archive className="h-10 w-10" />} title="No archived chats" /> :
          archived.map((chat) => <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} meId={useAuth().profile?.id ?? ''} onClick={() => openChat(chat.id)} />)}
      </div>
    </div>
  )
}

function StarredPanel({ me }: { me: Profile }) {
  const { starred } = useChats()
  const { openChat, setLeftView } = useUI()
  const [items, setItems] = useState<Message[]>([])

  useEffect(() => {
    if (starred.size === 0) { setItems([]); return }
    void supabase.from('messages').select('*').in('id', [...starred]).order('created_at', { ascending: false }).then(({ data }) => setItems((data ?? []) as Message[]))
  }, [starred])

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Starred</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? <EmptyNote icon={<Star className="h-10 w-10" />} title="No starred messages" body="Star messages to find them here" /> :
          items.map((m) => (
            <button key={m.id} type="button" onClick={() => openChat(m.conversation_id)} className="block w-full px-4 py-3 text-left hover:bg-hover">
              <p className="truncate text-[15px] text-ink">{m.deleted_for_everyone ? 'This message was deleted' : messagePreview(m)}</p>
              <p className="mt-0.5 text-[12px] text-ink-3">{formatConversationTime(m.created_at)}</p>
            </button>
          ))}
      </div>
    </div>
  )
}

function StatusPanel({ me }: { me: Profile }) {
  const { setLeftView } = useUI()
  const [statuses, setStatuses] = useState<{ user_id: string; content: string; created_at: string }[]>([])

  useEffect(() => {
    void supabase.from('statuses').select('user_id, content, created_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).then(({ data }) => {
      const seen = new Set<string>()
      setStatuses((data ?? []).filter((s: { user_id: string }) => !seen.has(s.user_id) && seen.add(s.user_id)))
    })
  }, [])

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Status</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar src={me.avatar_url} name={getDisplayName(me)} size={49} ring="unseen" />
            <div>
              <p className="text-[16px] font-medium text-ink">My status</p>
              <p className="text-[14px] text-ink-2">Tap to add status update</p>
            </div>
          </div>
        </div>
        <div className="border-t border-line px-4 py-2 text-[14px] font-medium text-ink-2">Recent updates</div>
        {statuses.length === 0 ? <EmptyNote icon={<CircleDot className="h-10 w-10" />} title="No status updates" /> :
          statuses.map((s) => (
            <div key={s.user_id + s.created_at} className="flex items-center gap-3 px-4 py-3 hover:bg-hover">
              <Avatar size={49} name={s.user_id} />
              <div>
                <p className="text-[16px] text-ink">{s.user_id.slice(0, 8)}</p>
                <p className="text-[14px] text-ink-2">{formatConversationTime(s.created_at)}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function CommunitiesPanel({ me }: { me: Profile }) {
  const { chats } = useChats()
  const { openChat, setLeftView } = useUI()
  const groups = chats.filter((c) => c.is_group)

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Communities</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <button type="button" onClick={() => setLeftView('new-group')} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-hover">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft"><Users className="h-6 w-6 text-accent" /></div>
          <span className="text-[16px] font-medium text-ink">New group</span>
        </button>
        <div className="border-t border-line px-4 py-2 text-[14px] font-medium text-ink-2">Your groups</div>
        {groups.length === 0 ? <EmptyNote icon={<Users className="h-10 w-10" />} title="No groups yet" /> :
          groups.map((g) => <ChatRow key={g.id} chat={g} active={false} meId={me.id} onClick={() => openChat(g.id)} />)}
      </div>
    </div>
  )
}

function SettingsPanel({ me }: { me: Profile }) {
  const prefs = usePrefs()
  const { setLeftView } = useUI()

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="mb-3 text-[14px] font-medium text-ink-2">Theme</h3>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as ThemePref[]).map((t) => (
              <button key={t} type="button" onClick={() => prefs.set({ theme: t })} className={clsx('rounded-full px-4 py-2 text-sm capitalize transition-colors', prefs.theme === t ? 'bg-accent text-white' : 'bg-field text-ink-2 hover:bg-hover')}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[14px] font-medium text-ink-2">Wallpaper</h3>
          <div className="grid grid-cols-4 gap-2">
            {WALLPAPERS.map((w) => (
              <button key={w.id} type="button" onClick={() => prefs.set({ wallpaper: w.id as WallpaperId })} className={clsx('rounded-lg p-2 text-xs transition-colors', prefs.wallpaper === w.id ? 'ring-2 ring-accent' : 'ring-1 ring-line')}>
                <div className="mb-1 h-12 rounded" style={{ background: w.light }} />
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[14px] font-medium text-ink-2">Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between"><span className="text-[15px] text-ink">Notifications</span><Toggle checked={prefs.notifications} onChange={(v) => prefs.set({ notifications: v })} label="Notifications" /></label>
            <label className="flex items-center justify-between"><span className="text-[15px] text-ink">Show previews</span><Toggle checked={prefs.notificationPreviews} onChange={(v) => prefs.set({ notificationPreviews: v })} label="Previews" /></label>
            <label className="flex items-center justify-between"><span className="text-[15px] text-ink">Sounds</span><Toggle checked={prefs.sounds} onChange={(v) => prefs.set({ sounds: v })} label="Sounds" /></label>
            <label className="flex items-center justify-between"><span className="text-[15px] text-ink">Enter to send</span><Toggle checked={prefs.enterToSend} onChange={(v) => prefs.set({ enterToSend: v })} label="Enter to send" /></label>
            <label className="flex items-center justify-between"><span className="text-[15px] text-ink">Doodle wallpaper</span><Toggle checked={prefs.doodles} onChange={(v) => prefs.set({ doodles: v })} label="Doodles" /></label>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfilePanel({ me }: { me: Profile }) {
  const { updateProfile, signOut } = useAuth()
  const { setLeftView } = useUI()
  const [name, setName] = useState(me.display_name)
  const [about, setAbout] = useState(me.about)
  const [avatar, setAvatar] = useState(me.avatar_url)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateProfile({ display_name: name.trim(), about: about.trim(), avatar_url: avatar })
      setLeftView('chats')
    } catch (e) { toastError(e) } finally { setSaving(false) }
  }

  return (
    <div className="flex h-full flex-col bg-panel">
      <header className="flex h-[59px] shrink-0 items-center gap-4 px-4">
        <IconButton label="Back" onClick={() => setLeftView('chats')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <h1 className="text-[18px] font-medium text-ink">Profile</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-col items-center gap-3">
          <AvatarPicker value={avatar} onChange={setAvatar} folder={me.id} size={200} name={name} />
          <p className="text-sm text-ink-2">{me.email}</p>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-accent">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={25} className="mt-1 w-full border-b-2 border-line bg-transparent py-2 text-[15px] text-ink outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="text-sm text-accent">About</span>
            <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={139} className="mt-1 w-full border-b-2 border-line bg-transparent py-2 text-[15px] text-ink outline-none focus:border-accent" />
          </label>
        </div>
        <div className="mt-8 flex justify-between">
          <button type="button" onClick={() => void signOut()} className="text-sm text-ink-2 hover:underline">Log out</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60">
            {saving && <Spinner className="h-4 w-4 border-white border-t-transparent" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CallOverlay({ chatId, video, onClose }: { chatId: string; video: boolean; onClose: () => void }) {
  const { chats } = useChats()
  const chat = chats.find((c) => c.id === chatId)
  const title = chat ? chatTitle(chat) : 'Call'
  const [status, setStatus] = useState<'calling' | 'connected' | 'ended'>('calling')

  useEffect(() => {
    const t = setTimeout(() => setStatus('connected'), 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-[#0b141a] p-8 text-white">
      <div className="mt-12 flex flex-col items-center gap-3">
        <Avatar src={chat ? chatAvatar(chat) : null} name={title} size={120} group={chat?.is_group} />
        <h2 className="text-[24px] font-light">{title}</h2>
        <p className="text-sm text-white/60">{video ? 'Video call' : 'Voice call'} — {status === 'calling' ? 'Calling…' : status === 'connected' ? 'Connected (simulated)' : 'Ended'}</p>
        <p className="mt-2 text-xs text-white/40">This is a UI simulation. No audio or video is transmitted.</p>
      </div>
      <div className="flex gap-4">
        {video && (
          <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Camera">
            <Camera className="h-6 w-6" />
          </button>
        )}
        <button type="button" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-700" aria-label="End call" onClick={() => { setStatus('ended'); onClose() }}>
          <Phone className="h-6 w-6 rotate-[135deg]" />
        </button>
      </div>
    </div>
  )
}
