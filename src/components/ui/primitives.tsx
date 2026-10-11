import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }>(
  function IconButton({ label, active, className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 dark:hover:bg-white/10',
          active && 'bg-black/10 dark:bg-white/10',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    )
  },
)

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  icon?: ReactNode
  hidden?: boolean
}

export function Menu({
  items,
  trigger,
  align = 'right',
  className,
}: {
  items: MenuItem[]
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; up: boolean }>({ top: 0, up: false })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const toggle = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const up = r.bottom + 280 > window.innerHeight && r.top > 280
      setPos({
        top: up ? r.top : r.bottom + 4,
        up,
        ...(align === 'right' ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) }),
      })
    }
    setOpen((o) => !o)
  }

  const visible = items.filter((i) => !i.hidden)
  return (
    <>
      {trigger({ open, toggle, ref: btnRef })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={clsx('fixed z-[60] min-w-[200px] animate-pop rounded-md bg-panel py-2 shadow-menu dark:bg-[#233138]', className)}
            style={{
              top: pos.up ? undefined : pos.top,
              bottom: pos.up ? window.innerHeight - pos.top + 4 : undefined,
              left: pos.left,
              right: pos.right,
            }}
          >
            {visible.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={clsx(
                  'flex w-full items-center gap-3 px-6 py-2.5 text-left text-[14.5px] hover:bg-hover dark:hover:bg-[#182229]',
                  item.danger ? 'text-danger' : 'text-ink',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-md',
}: {
  title?: string
  onClose: () => void
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4 dark:bg-black/60" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('flex max-h-[90vh] w-full animate-pop flex-col overflow-hidden rounded-lg bg-panel shadow-menu dark:bg-[#3b4a54]/0 dark:bg-panel', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center gap-4 bg-header px-4 py-3">
            <IconButton label="Close" onClick={onClose}>
              <X className="h-5 w-5" />
            </IconButton>
            <h2 className="text-base font-medium text-ink">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent', className)}
    />
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-ink-3/50')}
    >
      <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

export function PanelHeader({ title, onBack, children }: { title: string; onBack?: () => void; children?: ReactNode }) {
  return (
    <header className="flex h-[59px] shrink-0 items-center gap-6 bg-panel px-4 md:h-[64px] md:px-5">
      {onBack && (
        <IconButton label="Back" onClick={onBack} className="-ml-2">
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path fill="currentColor" d="M12 4l1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8 8-8z" />
          </svg>
        </IconButton>
      )}
      <h1 className="flex-1 text-[22px] font-bold text-ink md:text-[22px]">{title}</h1>
      {children}
    </header>
  )
}

export function EmptyNote({ icon, title, body }: { icon: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-12 text-center">
      <div className="mb-4 text-ink-3">{icon}</div>
      <p className="text-[15px] text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-2">{body}</p>}
    </div>
  )
}

export function RowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
