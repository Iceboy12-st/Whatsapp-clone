import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, errorMessage } from '@/lib/supabase'
import type { Profile } from '@/types'

type Result = { error: string | null }

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<Result>
  signUp: (email: string, password: string, displayName: string) => Promise<Result & { needsConfirmation: boolean }>
  signInWithGoogle: () => Promise<Result>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<Omit<Profile, 'id' | 'email' | 'created_at'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const user = session?.user ?? null
  const userId = user?.id

  const fetchProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    setProfile((data as Profile | null) ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    void fetchProfile(userId)
  }, [userId, fetchProfile])

  useEffect(() => {
    if (!userId) return
    const touch = () => {
      void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId)
    }
    touch()
    const id = window.setInterval(touch, 60_000)
    const onHide = () => document.visibilityState === 'hidden' && touch()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', touch)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', touch)
    }
  }, [userId])

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? errorMessage(error) : null }
      },
      signUp: async (email, password, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
        })
        return { error: error ? errorMessage(error) : null, needsConfirmation: !error && !data.session }
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        return { error: error ? errorMessage(error) : null }
      },
      signOut: async () => {
        if (userId) await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId)
        await supabase.auth.signOut()
      },
      refreshProfile: async () => {
        if (userId) await fetchProfile(userId)
      },
      updateProfile: async (patch) => {
        if (!userId) return
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select('*')
          .single()
        if (error) throw error
        setProfile(data as Profile)
      },
    }),
    [session, user, profile, loading, userId, fetchProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useMe(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useMe requires a loaded profile')
  return profile
}
