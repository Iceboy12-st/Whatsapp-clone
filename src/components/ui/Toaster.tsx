import clsx from 'clsx'
import { useToasts } from '@/store/toast'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={clsx(
            'pointer-events-auto animate-slide-up rounded-md px-5 py-3 text-sm text-white shadow-menu',
            t.tone === 'error' ? 'bg-danger' : 'bg-[#3b4a54]',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
