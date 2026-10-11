import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ChatItem, Conversation, ConversationParticipant, Member, Message, Profile } from '@/types'

interface ChatsState {
  chats: ChatItem[]
  loaded: boolean
  error: string | null
  blocked: Set<string>
  starred: Set<string>
  load: (userId: string) => Promise<void>
  patchMe: (chatId: string, patch: Partial<ConversationParticipant>) => Promise<void>
  patchChat: (chatId: string, patch: Partial<ChatItem>) => void
  onMessage: (m: Message, userId: string, activeChatId: string | null) => void
  loadBlocked: (userId: string) => Promise<void>
  loadStarred: (userId: string) => Promise<void>
  reset: () => void
}

let loadSeq = 0

export const useChats = create<ChatsState>((set, get) => ({
  chats: [],
  loaded: false,
  error: null,
  blocked: new Set(),
  starred: new Set(),

  load: async (userId) => {
    const seq = ++loadSeq
    const { data: mine, error } = await supabase
      .from('conversation_participants')
      .select('*, conversations(*)')
      .eq('user_id', userId)
    if (error) {
      set({ error: error.message, loaded: true })
      return
    }
    const ids = (mine ?? []).map((r) => r.conversation_id as string)
    if (ids.length === 0) {
      if (seq === loadSeq) set({ chats: [], loaded: true, error: null })
      return
    }
    const [membersRes, summaryRes] = await Promise.all([
      supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, role, created_at, profiles(*)')
        .in('conversation_id', ids),
      supabase.rpc('get_chat_summaries'),
    ])
    if (membersRes.error || summaryRes.error) {
      set({ error: (membersRes.error ?? summaryRes.error)!.message, loaded: true })
      return
    }
    const membersBy = new Map<string, Member[]>()
    for (const r of membersRes.data ?? []) {
      const profile = r.profiles as unknown as Profile | null
      if (!profile) continue
      const list = membersBy.get(r.conversation_id) ?? []
      list.push({ profile, role: r.role, joined_at: r.created_at })
      membersBy.set(r.conversation_id, list)
    }
    const summaries = new Map<string, { last_message: Message | null; unread_count: number }>()
    for (const s of (summaryRes.data ?? []) as { conversation_id: string; last_message: Message | null; unread_count: number }[]) {
      summaries.set(s.conversation_id, s)
    }
    const chats: ChatItem[] = (mine ?? []).flatMap((row) => {
      const conv = row.conversations as unknown as Conversation | null
      if (!conv) return []
      const { conversations: _c, ...me } = row
      const members = membersBy.get(conv.id) ?? []
      const sum = summaries.get(conv.id)
      return [{
        ...conv,
        me: me as ConversationParticipant,
        members,
        other: conv.is_group ? null : members.find((m) => m.profile.id !== userId)?.profile ?? null,
        last_message: sum?.last_message ?? null,
        unread_count: sum?.unread_count ?? 0,
      }]
    })
    if (seq === loadSeq) set({ chats, loaded: true, error: null })
  },

  patchMe: async (chatId, patch) => {
    const prev = get().chats
    set({ chats: prev.map((c) => (c.id === chatId ? { ...c, me: { ...c.me, ...patch } } : c)) })
    const chat = prev.find((c) => c.id === chatId)
    if (!chat) return
    const { error } = await supabase
      .from('conversation_participants')
      .update(patch)
      .eq('conversation_id', chatId)
      .eq('user_id', chat.me.user_id)
    if (error) {
      set({ chats: prev })
      throw error
    }
  },

  patchChat: (chatId, patch) => set({ chats: get().chats.map((c) => (c.id === chatId ? { ...c, ...patch } : c)) }),

  onMessage: (m, userId, activeChatId) => {
    const chats = get().chats
    const chat = chats.find((c) => c.id === m.conversation_id)
    if (!chat) return
    const isNewer = !chat.last_message || new Date(m.created_at) >= new Date(chat.last_message.created_at)
    const bumpUnread = m.sender_id !== userId && m.type !== 'system' && activeChatId !== m.conversation_id
    set({
      chats: chats.map((c) =>
        c.id === m.conversation_id
          ? {
              ...c,
              last_message: isNewer || c.last_message?.id === m.id ? m : c.last_message,
              unread_count: bumpUnread && isNewer ? c.unread_count + 1 : c.unread_count,
              updated_at: isNewer ? m.created_at : c.updated_at,
              me: { ...c.me, is_hidden: false, is_archived: c.me.is_archived && !!c.me.muted_until },
            }
          : c,
      ),
    })
  },

  loadBlocked: async (userId) => {
    const { data } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId)
    set({ blocked: new Set((data ?? []).map((r) => r.blocked_id as string)) })
  },

  loadStarred: async (userId) => {
    const { data } = await supabase.from('starred_messages').select('message_id').eq('user_id', userId)
    set({ starred: new Set((data ?? []).map((r) => r.message_id as string)) })
  },

  reset: () => set({ chats: [], loaded: false, error: null, blocked: new Set(), starred: new Set() }),
}))

export function sortChats(list: ChatItem[]): ChatItem[] {
  const ts = (c: ChatItem) => new Date(c.last_message?.created_at ?? c.created_at).getTime()
  return [...list].sort((a, b) => Number(b.me.is_pinned) - Number(a.me.is_pinned) || ts(b) - ts(a))
}
