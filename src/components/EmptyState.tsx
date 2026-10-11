import { MessageCircle, Lock } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-wa-bg-panel px-8 text-center">
      <div className="max-w-md">
        <div className="w-48 h-48 mx-auto mb-6 bg-wa-bg rounded-full flex items-center justify-center">
          <MessageCircle className="w-20 h-20 text-wa-teal/40" />
        </div>
        <h1 className="text-3xl font-light text-wa-text mb-3">WhatsApp Clone</h1>
        <p className="text-sm text-wa-text-secondary leading-relaxed mb-6">
          Send and receive messages without keeping your phone online.
          Use WhatsApp on up to 2 linked devices and 1 phone at the same time.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-wa-text-secondary border-t border-wa-border pt-4">
          <Lock className="w-3.5 h-3.5" />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>
      </div>
    </div>
  )
}
