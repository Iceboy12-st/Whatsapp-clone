import { getInitials, getAvatarColor } from '@/lib/utils'
import clsx from 'clsx'

interface AvatarProps {
  name: string
  id: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  ring?: boolean
}

const sizeClasses = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-28 h-28 text-3xl',
}

export default function Avatar({ name, id, src, size = 'md', ring }: AvatarProps) {
  const initials = getInitials(name)
  const colorClass = getAvatarColor(id)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx(
          'rounded-full object-cover flex-shrink-0',
          sizeClasses[size],
          ring && 'ring-2 ring-white ring-offset-2'
        )}
      />
    )
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none',
        colorClass,
        sizeClasses[size],
        ring && 'ring-2 ring-white ring-offset-2'
      )}
    >
      {initials}
    </div>
  )
}
