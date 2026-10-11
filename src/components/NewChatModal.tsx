import { useState, useEffect } from 'react'
import { Search, X, MessageCircle, Loader as Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getDisplayName } from '@/lib/utils'
import type { Profile } from '@/types'
import Avatar from './Avatar'

interface NewChatModalProps {
  onClose: () => void
  onConversationCreated: (conversationId: string) => void
}

export default function NewChatModal({ onClose, onConversationCreated }: NewChatModalProps) {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!search.trim() || !user) {
        setResults([])
        return
      }

      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .or(`display_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(20)

      setResults((data ?? []) as Profile[])
      setLoading(false)
    }, 300)

    return () => clearTimeout(delay)
  }, [search, user])

  async function startChatWith(otherUser: Profile) {
    if (!user) return
    setCreating(otherUser.id)

    // Check if a 1:1 conversation already exists between these two users
    const { data: existingParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (existingParts && existingParts.length > 0) {
      const myConvIds = existingParts.map((p) => p.conversation_id)

      const { data: otherParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUser.id)
        .in('conversation_id', myConvIds)

      if (otherParts && otherParts.length > 0) {
        // Found a shared conversation — check if it's 1:1 (not group)
        for (const op of otherParts) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, is_group')
            .eq('id', op.conversation_id)
            .maybeSingle()

          if (conv && !conv.is_group) {
            onConversationCreated(conv.id)
            return
          }
        }
      }
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        is_group: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !newConv) {
      setCreating(null)
      return
    }

    await supabase.from('conversation_participants').insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: otherUser.id },
    ])

    onConversationCreated(newConv.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-wa-teal-dark px-4 py-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">New chat</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/15 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-wa-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-wa-green/30 transition-all text-wa-text"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {!search.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <MessageCircle className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Search for people by name or email</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-sm text-gray-500">No users found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different name or email</p>
            </div>
          ) : (
            results.map((profile) => (
              <button
                key={profile.id}
                onClick={() => startChatWith(profile)}
                disabled={creating !== null}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
              >
                <Avatar name={getDisplayName(profile)} id={profile.id} src={profile.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-wa-text truncate text-[15px]">
                    {getDisplayName(profile)}
                  </div>
                  <div className="text-sm text-wa-text-secondary truncate">{profile.about}</div>
                </div>
                {creating === profile.id && (
                  <Loader2 className="w-5 h-5 text-wa-green animate-spin" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
