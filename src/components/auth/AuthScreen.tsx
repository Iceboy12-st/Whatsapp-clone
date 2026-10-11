import { useState, type FormEvent } from 'react'
import { Lock, MessageCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui/primitives'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full bg-app">
      <div className="absolute inset-x-0 top-0 h-[222px] bg-accent dark:bg-header" />
      <div className="relative mx-auto flex min-h-full max-w-[1000px] flex-col px-4 pb-10">
        <div className="flex items-center gap-3 py-7 text-white">
          <MessageCircle className="h-9 w-9" aria-hidden />
          <span className="text-sm font-medium uppercase tracking-wide">WhatsApp Web</span>
        </div>
        <main className="flex-1 rounded-sm bg-panel p-6 shadow-menu md:p-14">{children}</main>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-2">
          <Lock className="h-3 w-3" aria-hidden /> Your personal messages are end-to-end encrypted in WhatsApp; this clone stores them in your Supabase project.
        </p>
      </div>
    </div>
  )
}

const fieldCls =
  'w-full border-b-2 border-line bg-transparent px-1 py-2 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent'

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'up' && name.trim().length < 1) return setError('Please enter your name')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setBusy(true)
    if (mode === 'in') {
      const r = await signIn(email.trim(), password)
      if (r.error) setError(r.error)
    } else {
      const r = await signUp(email.trim(), password, name.trim())
      if (r.error) setError(r.error)
      else if (r.needsConfirmation) setInfo('Check your inbox to confirm your email, then sign in.')
    }
    setBusy(false)
  }

  async function onGoogle() {
    setError(null)
    const r = await signInWithGoogle()
    if (r.error) setError(r.error)
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-12 md:flex-row">
        <div className="flex-1">
          <h1 className="text-[28px] font-light text-ink">{mode === 'in' ? 'Use WhatsApp on your computer' : 'Create your account'}</h1>
          <ol className="mt-8 list-decimal space-y-4 pl-5 text-[17px] leading-relaxed text-ink-2">
            <li>Sign in with email and password, or continue with Google.</li>
            <li>Set up your profile name, photo and About.</li>
            <li>Search for people by name or email to start chatting.</li>
          </ol>
        </div>
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6" noValidate>
          {mode === 'up' && (
            <label className="block">
              <span className="text-sm text-accent">Your name</span>
              <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={25} required />
            </label>
          )}
          <label className="block">
            <span className="text-sm text-accent">Email</span>
            <input className={fieldCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="block">
            <span className="text-sm text-accent">Password</span>
            <input
              className={fieldCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
            />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {info && <p role="status" className="text-sm text-accent">{info}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-60 dark:text-[#111b21]"
          >
            {busy && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={onGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:bg-hover"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
          <p className="text-center text-sm text-ink-2">
            {mode === 'in' ? 'New here? ' : 'Already have an account? '}
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null) }}>
              {mode === 'in' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </AuthShell>
  )
}
