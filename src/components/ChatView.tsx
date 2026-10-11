import { useEffect, useRef, useState } from 'react'
import { Send, Smile, Paperclip, ArrowLeft, MoreVertical, Trash2, Check, CheckCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useMessages } from '@/hooks/useMessages'
import { useConversations } from '@/hooks/useConversations'
import { getDisplayName, formatMessageTime, formatChatDate } from '@/lib/utils'
import Avatar from './Avatar'
import clsx from 'clsx'
import type { MessageWithSender } from '@/types'

interface ChatViewProps {
  conversationId: string
  onBack: () => void
}

export default function ChatView({ conversationId, onBack }: ChatViewProps) {
  const { user } = useAuth()
  const { conversations } = useConversations()
  const { messages, loading, sendMessage, deleteMessage, markAsRead } = useMessages(conversationId)
  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const conversation = conversations.find((c) => c.id === conversationId)
  const otherParticipant = conversation?.participants.find((p) => p.id !== user?.id)

  const chatName = conversation?.is_group
    ? (conversation.name ?? 'Group Chat')
    : otherParticipant
      ? getDisplayName(otherParticipant)
      : 'Unknown'

  const chatAvatarId = conversation?.is_group ? conversation.id : (otherParticipant?.id ?? conversationId)
  const chatAvatarSrc = conversation?.is_group ? conversation.avatar_url : (otherParticipant?.avatar_url ?? null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read when conversation opens or new messages arrive
  useEffect(() => {
    markAsRead()
  }, [conversationId, messages.length, markAsRead])

  function handleSend() {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; items: MessageWithSender[] }[] = []
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString()
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.items.push(msg)
    } else {
      groupedMessages.push({ date: dateKey, items: [msg] })
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center chat-bg-pattern">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-wa-bg-panel">
      {/* Header */}
      <div className="bg-wa-teal-dark px-4 py-2 flex items-center justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-1.5 hover:bg-white/15 rounded-full text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Avatar name={chatName} id={chatAvatarId} src={chatAvatarSrc} size="sm" />
          <div className="min-w-0">
            <div className="text-white font-medium text-[15px] truncate">{chatName}</div>
            <div className="text-white/70 text-xs truncate">
              {conversation.is_group
                ? `${conversation.participants.length} members`
                : (otherParticipant?.about ?? 'online')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 relative">
          <button className="p-2 hover:bg-white/15 rounded-full text-white transition-colors" title="Attach">
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-white/15 rounded-full text-white transition-colors"
            title="Menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-xl py-1 w-44 animate-pop origin-top-right">
                <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">Conversation info</div>
                <div className="px-4 py-1.5 text-sm text-wa-text">
                  {conversation.is_group ? 'Group chat' : 'Direct message'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto chat-bg-pattern px-4 md:px-8 lg:px-16 py-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="bg-wa-teal/10 rounded-full p-4 mb-3">
              <Smile className="w-8 h-8 text-wa-teal" />
            </div>
            <p className="text-wa-text-secondary text-sm">
              No messages yet. Say hello to {chatName}!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group, gi) => (
              <div key={gi}>
                <div className="flex justify-center my-3">
                  <span className="bg-white/80 text-wa-text-secondary text-xs px-3 py-1 rounded-lg shadow-sm">
                    {formatChatDate(group.date)}
                  </span>
                </div>
                {group.items.map((msg, mi) => {
                  const isMine = msg.sender_id === user?.id
                  const prevMsg = mi > 0 ? group.items[mi - 1] : null
                  const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id
                  const nextMsg = mi < group.items.length - 1 ? group.items[mi + 1] : null
                  const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isMine={isMine}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                      senderName={msg.sender ? getDisplayName(msg.sender) : 'Unknown'}
                      onDelete={() => deleteMessage(msg.id)}
                    />
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-wa-bg-panel px-4 py-3 flex items-end gap-2 flex-shrink-0">
        <div className="flex-1 bg-white rounded-3xl flex items-end gap-2 px-3 py-2 shadow-sm">
          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <Smile className="w-6 h-6" />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <Paperclip className="w-6 h-6" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            rows={1}
            className="flex-1 resize-none outline-none text-wa-text text-[15px] py-1.5 max-h-32 bg-transparent"
            style={{ minHeight: '24px' }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className={clsx(
            'p-3 rounded-full transition-all flex-shrink-0 active:scale-95',
            input.trim()
              ? 'bg-wa-green text-white hover:bg-wa-green-dark shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  isMine,
  isFirstInGroup,
  isLastInGroup,
  senderName,
  onDelete,
}: {
  message: MessageWithSender
  isMine: boolean
  isFirstInGroup: boolean
  isLastInGroup: boolean
  senderName: string
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={clsx(
        'flex group',
        isMine ? 'justify-end' : 'justify-start',
        isLastInGroup ? 'mb-1' : 'mb-0.5'
      )}
    >
      <div
        className="relative max-w-[75%] md:max-w-[60%]"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div
          className={clsx(
            'relative px-3 py-2 shadow-sm text-[15px] break-words',
            isMine
              ? 'bg-wa-bubble-out text-wa-text rounded-lg'
              : 'bg-wa-bubble-in text-wa-text rounded-lg',
            isFirstInGroup && isMine && 'rounded-tr-none',
            isFirstInGroup && !isMine && 'rounded-tl-none',
            !isFirstInGroup && isMine && 'rounded-tr-lg',
            !isFirstInGroup && !isMine && 'rounded-tl-lg'
          )}
        >
          {!isMine && isFirstInGroup && (
            <div className="text-wa-teal text-xs font-medium mb-0.5">{senderName}</div>
          )}
          <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          <div className="flex items-center gap-1 justify-end mt-0.5 -mb-0.5">
            <span className="text-[10px] text-wa-text-secondary/70">
              {formatMessageTime(message.created_at)}
            </span>
            {isMine && <Check className="w-3.5 h-3.5 text-wa-text-secondary/70" />}
          </div>
        </div>

        {showActions && isMine && (
          <button
            onClick={onDelete}
            className="absolute -top-3 -right-2 bg-white shadow-md rounded-full p-1 text-gray-400 hover:text-red-500 transition-colors animate-pop z-10"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
