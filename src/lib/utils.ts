import { format, isToday, isYesterday, isThisWeek, isThisYear, differenceInMinutes } from 'date-fns'
import type { ChatItem, Message, Profile } from '@/types'

export function formatMessageTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm')
}

export function formatConversationTime(date: string | Date | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEEE')
  return format(d, 'dd/MM/yyyy')
}

export function formatChatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEEE')
  if (isThisYear(d)) return format(d, 'd MMMM')
  return format(d, 'd MMMM yyyy')
}

export function formatLastSeen(date: string | null): string {
  if (!date) return ''
  const d = new Date(date)
  if (differenceInMinutes(new Date(), d) < 1) return 'last seen just now'
  if (isToday(d)) return `last seen today at ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `last seen yesterday at ${format(d, 'HH:mm')}`
  return `last seen ${format(d, 'dd/MM/yyyy')} at ${format(d, 'HH:mm')}`
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function getDisplayName(profile: Pick<Profile, 'display_name' | 'email'> | null | undefined): string {
  if (!profile) return 'Unknown'
  return profile.display_name || profile.email.split('@')[0]
}

export function chatTitle(chat: ChatItem): string {
  if (chat.is_group) return chat.name || 'Group'
  return getDisplayName(chat.other)
}

export function chatAvatar(chat: ChatItem): string | null {
  return chat.is_group ? chat.avatar_url : chat.other?.avatar_url ?? null
}

export function isMuted(chat: ChatItem): boolean {
  return Boolean(chat.me.muted_until && new Date(chat.me.muted_until) > new Date())
}

export function messagePreview(m: Message | null): string {
  if (!m) return ''
  if (m.deleted_for_everyone) return 'This message was deleted'
  switch (m.type) {
    case 'image':
      return m.content || 'Photo'
    case 'video':
      return m.content || 'Video'
    case 'audio':
      return `Voice message${m.duration ? ` (${formatDuration(m.duration)})` : ''}`
    case 'document':
      return m.media_name || 'Document'
    default:
      return m.content
  }
}

const AVATAR_COLORS = [
  'bg-rose-500', 'bg-pink-500', 'bg-fuchsia-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500',
  'bg-lime-600', 'bg-green-600', 'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-sky-600',
  'bg-blue-600', 'bg-indigo-500', 'bg-violet-500',
]

function hash(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return Math.abs(h)
}

export function getAvatarColor(id: string): string {
  return AVATAR_COLORS[hash(id) % AVATAR_COLORS.length]
}

// Sender name colours used in group chats (WhatsApp-like palette, readable on both themes).
const SENDER_COLORS = [
  '#e542a3', '#1f7aec', '#d3720e', '#7f66ff', '#06a58f', '#c4532d', '#029d00', '#a62c71',
  '#2b9bb5', '#b07a00', '#5e47de', '#d83a52',
]

export function getSenderColor(id: string): string {
  return SENDER_COLORS[hash(id) % SENDER_COLORS.length]
}

export function pseudoWaveform(seed: string, bars = 40): number[] {
  let h = hash(seed) || 1
  return Array.from({ length: bars }, () => {
    h = (h * 9301 + 49297) % 233280
    return 0.2 + (h / 233280) * 0.8
  })
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g

export function splitLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const i = match.index ?? 0
    if (i > last) parts.push({ text: text.slice(last, i) })
    parts.push({ text: match[0], href: match[0] })
    last = i + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

export function extractLinks(text: string): string[] {
  return Array.from(text.matchAll(URL_RE), (m) => m[0])
}

export function uuid(): string {
  return crypto.randomUUID()
}
