import { useState } from 'react'
import { Users, User } from 'lucide-react'
import clsx from 'clsx'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: number
  group?: boolean
  online?: boolean
  ring?: 'unseen' | 'seen' | null
  className?: string
}

export function Avatar({ src, name, size = 49, group, online, ring, className }: AvatarProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const showImg = src && failed !== src
  const Icon = group ? Users : User
  return (
    <div
      className={clsx('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <div
        className={clsx(
          'h-full w-full overflow-hidden rounded-full',
          ring && 'p-[2px]',
          ring === 'unseen' && 'bg-accent',
          ring === 'seen' && 'bg-ink-3',
        )}
      >
        <div className={clsx('h-full w-full overflow-hidden rounded-full', ring && 'border-2 border-panel')}>
          {showImg ? (
            <img
              src={src}
              alt={name ? `${name} profile photo` : ''}
              className="h-full w-full object-cover"
              onError={() => setFailed(src)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#dfe5e7] text-white dark:bg-[#6a7175]">
              <Icon aria-hidden style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.6} className="text-white" />
              {name && <span className="sr-only">{name}</span>}
            </div>
          )}
        </div>
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-panel bg-[#25d366]"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
          aria-label="Online"
        />
      )}
    </div>
  )
}
