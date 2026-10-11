import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useApplyTheme } from '@/hooks/useTheme'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { ProfileSetup } from '@/components/auth/ProfileSetup'
import { Shell } from '@/components/shell/Shell'
import { Toaster } from '@/components/ui/Toaster'

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-panel">
      <MessageCircle className="h-16 w-16 text-ink-3" aria-hidden />
      <div className="h-[3px] w-[320px] overflow-hidden rounded bg-line">
        <div className="h-full w-1/3 animate-[slideLeft_1.2s_ease-in-out_infinite_alternate] bg-accent" />
      </div>
      <p className="text-ink">WhatsApp</p>
    </div>
  )
}

function MissingConfig() {
  return (
    <div className="flex h-full items-center justify-center bg-app p-6">
      <div className="max-w-md rounded-lg bg-panel p-8 shadow-menu">
        <h1 className="text-xl font-medium text-ink">Supabase is not configured</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Set <code className="rounded bg-field px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-field px-1">VITE_SUPABASE_ANON_KEY</code> in your environment, then restart the dev server. See README.md for setup steps.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  useApplyTheme()
  const { session, profile, loading } = useAuth()

  let screen: React.ReactNode
  if (!isSupabaseConfigured) screen = <MissingConfig />
  else if (loading) screen = <Splash />
  else if (!session) screen = <AuthScreen />
  else if (!profile) screen = <Splash />
  else if (!profile.onboarded) screen = <ProfileSetup />
  else screen = <Shell me={profile} />

  return (
    <>
      {screen}
      <Toaster />
    </>
  )
}
