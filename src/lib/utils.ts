import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns'

export function formatMessageTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'HH:mm')
}

export function formatConversationTime(date: string | Date | null): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEE')
  if (isThisYear(d)) return format(d, 'dd/MM')
  return format(d, 'dd/MM/yyyy')
}

export function formatChatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  if (isThisWeek(d)) return format(d, 'EEEE')
  if (isThisYear(d)) return format(d, 'EEEE, dd MMMM')
  return format(d, 'EEEE, dd MMMM yyyy')
}

export function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function getDisplayName(profile: { display_name: string; email: string }): string {
  return profile.display_name || profile.email.split('@')[0]
}

const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-pink-500',
  'bg-fuchsia-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
]

export function getAvatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
