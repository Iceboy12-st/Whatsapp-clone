import { useState } from 'react'
import { X, Camera, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getDisplayName } from '@/lib/utils'
import Avatar from './Avatar'

interface ProfileSettingsProps {
  onClose: () => void
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const { profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [about, setAbout] = useState(profile?.about ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        about: about.trim() || 'Available',
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      setError('Failed to save profile. Please try again.')
      setSaving(false)
      return
    }

    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-wa-teal-dark px-4 py-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/15 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar
                name={displayName || getDisplayName(profile)}
                id={profile.id}
                src={avatarUrl || null}
                size="xl"
              />
              <div className="absolute bottom-0 right-0 bg-wa-green rounded-full p-2 shadow-lg border-2 border-white">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">{profile.email}</p>
          </div>

          {/* Display name */}
          <div>
            <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
              Your Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
              placeholder="Enter your name"
            />
          </div>

          {/* About */}
          <div>
            <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
              About
            </label>
            <input
              type="text"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
              placeholder="Available"
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="text-xs font-medium text-wa-text-secondary uppercase tracking-wide">
              Avatar URL (optional)
            </label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-wa-green focus:ring-2 focus:ring-wa-green/20 outline-none transition-all text-wa-text"
              placeholder="https://..."
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-wa-green hover:bg-wa-green-dark text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-60 shadow-md active:scale-[0.98]"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-5 h-5" />
                Saved!
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
