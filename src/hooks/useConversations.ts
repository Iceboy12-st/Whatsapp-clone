import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Conversation, ConversationParticipant, Profile, Message, ConversationWithDetails } from '@/types'

export function useConversations() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    if (!user) return

    const { data: participantRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, user_id, created_at')
      .eq('user_id', user.id)

    if (!participantRows || participantRows.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const typedParticipants = participantRows as ConversationParticipant[]
    const conversationIds = typedParticipants.map((p) => p.conversation_id)
    const lastReadMap = new Map(
      typedParticipants.map((p) => [p.conversation_id, p.last_read_at])
    )

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })

    if (!convs || convs.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)

    const userIds = Array.from(new Set((allParticipants ?? []).map((p) => p.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map((profiles ?? []).map((p: Profile) => [p.id, p]))
    const participantsByConv = new Map<string, Profile[]>()
    for (const p of allParticipants ?? []) {
      const arr = participantsByConv.get(p.conversation_id) ?? []
      const prof = profileMap.get(p.user_id)
      if (prof) arr.push(prof)
      participantsByConv.set(p.conversation_id, arr)
    }

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })

    const lastMessageByConv = new Map<string, Message>()
    for (const m of lastMessages ?? []) {
      if (!lastMessageByConv.has(m.conversation_id)) {
        lastMessageByConv.set(m.conversation_id, m)
      }
    }

    const { data: unreadMessages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)

    const result: ConversationWithDetails[] = (convs as Conversation[]).map((conv) => {
      const lastRead = lastReadMap.get(conv.id)
      const unread = (unreadMessages as Message[] ?? []).filter((m) => {
        if (m.conversation_id !== conv.id) return false
        if (m.sender_id === user.id) return false
        if (!lastRead) return true
        return new Date(m.created_at) > new Date(lastRead)
      })

      return {
        ...conv,
        participants: participantsByConv.get(conv.id) ?? [],
        last_message: lastMessageByConv.get(conv.id) ?? null,
        unread_count: unread.length,
      }
    })

    result.sort((a, b) => {
      const aTime = a.last_message?.created_at ?? a.updated_at
      const bTime = b.last_message?.created_at ?? b.updated_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    setConversations(result)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${user.id}` },
        () => fetchConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchConversations])

  return { conversations, loading, refetch: fetchConversations }
}
