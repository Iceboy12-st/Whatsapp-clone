import { useState, type FormEvent } from 'react'
import { useAuth, useMe } from '@/context/AuthContext'
import { AuthShell } from './AuthScreen'
import { AvatarPicker } from '@/components/ui/AvatarPicker'
import { Spinner } from '@/components/ui/primitives'
import { errorMessage } from '@/lib/supabase'

export function ProfileSetup() {
  const me = useMe()
  const { updateProfile, signOut } = useAuth()
  const [name, setName] = useState(me.display_name || '')
  const [about, setAbout] = useState(me.about || 'Hey there! I am using WhatsApp.')
  const [avatar, setAvatar] = useState(me.avatar_url)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your name')
    setBusy(true)
    try {
      await updateProfile({ display_name: name.trim(), about: about.trim(), avatar_url: avatar, onboarded: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="mx-auto flex max-w-sm flex-col items-center gap-8" noValidate>
        <div className="text-center">
          <h1 className="text-[28px] font-light text-ink">Profile info</h1>
          <p className="mt-2 text-sm text-ink-2">Please provide your name and an optional profile photo</p>
        </div>
        <AvatarPicker value={avatar} onChange={setAvatar} folder={me.id} size={200} name={name} />
        <label className="block w-full">
          <span className="text-sm text-accent">Your name</span>
          <input
            className="w-full border-b-2 border-line bg-transparent px-1 py-2 text-[15px] text-ink outline-none focus:border-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={25}
            autoFocus
          />
        </label>
        <label className="block w-full">
          <span className="text-sm text-accent">About</span>
          <input
            className="w-full border-b-2 border-line bg-transparent px-1 py-2 text-[15px] text-ink outline-none focus:border-accent"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={139}
          />
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex w-full items-center justify-between">
          <button type="button" onClick={() => void signOut()} className="text-sm text-ink-2 hover:underline">
            Log out
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-accent px-8 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60 dark:text-[#111b21]"
          >
            {busy && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
            Next
          </button>
        </div>
      </form>
    </AuthShell>
  )
}
