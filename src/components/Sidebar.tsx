import { useState } from 'react'
import { Search, MoreVertical, MessageSquarePlus, LogOut, Settings, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConversations } from '@/hooks/useConversations'
import type { ConversationWithDetails } from '@/types'
import { getDisplayName, formatConversationTime } from '@/lib/utils'
import Avatar from './Avatar'
import clsx from 'clsx'

interface SidebarProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onOpenSettings: () => void
}

export default function Sidebar({ selectedId, onSelect, onNewChat, onOpenSettings }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const { conversations, loading } = useConversations()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true
    const name = getConversationName(c, profile?.id ?? '')
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col bg-white border-r border-wa-border h-full">
      {/* Header */}
      <div className="bg-wa-teal-dark px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile && (
            <Avatar
              name={getDisplayName(profile)}
              id={profile.id}
              src={profile.avatar_url}
              size="sm"
            />
          )}
          <span className="text-white font-medium text-lg">Chats</span>
        </div>
        <div className="flex items-center gap-1 relative">
          <button
            onClick={onNewChat}
            className="p-2 hover:bg-white/15 rounded-full transition-colors text-white"
            title="New chat"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-white/15 rounded-full transition-colors text-white"
            title="Menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-xl py-1 w-48 animate-pop origin-top-right">
                <button
                  onClick={() => {
                    onOpenSettings()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-wa-text hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  Settings
                </button>
                <button
                  onClick={() => {
                    signOut()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-wa-border bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-10 pr-8 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-wa-green/30 transition-all text-wa-text"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <MessageSquarePlus className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">No conversations yet</p>
            <p className="text-xs text-gray-400 mt-1">Click the new chat icon to start chatting</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              currentUserId={profile?.id ?? ''}
              selected={selectedId === conv.id}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function getConversationName(conv: ConversationWithDetails, currentUserId: string): string {
  if (conv.is_group && conv.name) return conv.name
  const other = conv.participants.find((p) => p.id !== currentUserId)
  return other ? getDisplayName(other) : 'Unknown'
}

function ConversationItem({
  conv,
  currentUserId,
  selected,
  onClick,
}: {
  conv: ConversationWithDetails
  currentUserId: string
  selected: boolean
  onClick: () => void
}) {
  const name = getConversationName(conv, currentUserId)
  const other = conv.participants.find((p) => p.id !== currentUserId)
  const avatarId = conv.is_group ? conv.id : (other?.id ?? conv.id)
  const avatarName = conv.is_group ? (conv.name ?? 'Group') : name
  const avatarSrc = conv.is_group ? conv.avatar_url : (other?.avatar_url ?? null)

  let preview = ''
  if (conv.last_message) {
    const isMine = conv.last_message.sender_id === currentUserId
    preview = (isMine ? 'You: ' : '') + conv.last_message.content
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-3 border-b border-gray-100 transition-colors text-left',
        selected ? 'bg-gray-100' : 'hover:bg-wa-bg-hover'
      )}
    >
      <Avatar name={avatarName} id={avatarId} src={avatarSrc} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-wa-text truncate text-[15px]">{name}</span>
          {conv.last_message && (
            <span className={clsx(
              'text-xs flex-shrink-0',
              conv.unread_count > 0 ? 'text-wa-green font-semibold' : 'text-wa-text-secondary'
            )}>
              {formatConversationTime(conv.last_message.created_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-sm text-wa-text-secondary truncate">
            {preview || 'No messages yet'}
          </span>
          {conv.unread_count > 0 && (
            <span className="bg-wa-green text-white text-xs font-semibold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
