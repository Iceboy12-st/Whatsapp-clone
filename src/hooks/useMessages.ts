import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MessageWithSender, Profile } from '@/types'

export function useMessages(conversationId: string | null) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading] = useState(true)
  const profilesCache = useRef<Map<string, Profile>>(new Map())

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (!msgs || msgs.length === 0) {
      setMessages([])
      setLoading(false)
      return
    }

    const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)))
    const uncachedIds = senderIds.filter((id) => !profilesCache.current.has(id))

    if (uncachedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uncachedIds)
      for (const p of profiles ?? []) {
        profilesCache.current.set(p.id, p as Profile)
      }
    }

    const withSenders: MessageWithSender[] = msgs.map((m) => ({
      ...m,
      sender: profilesCache.current.get(m.sender_id) ?? null,
    }))

    setMessages(withSenders)
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as MessageWithSender
          const senderId = newMsg.sender_id

          if (!profilesCache.current.has(senderId)) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', senderId)
              .maybeSingle()
            if (profile) {
              profilesCache.current.set(senderId, profile as Profile)
            }
          }

          newMsg.sender = profilesCache.current.get(senderId) ?? null
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedId = payload.old.id
          setMessages((prev) => prev.filter((m) => m.id !== deletedId))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  async function sendMessage(content: string) {
    if (!conversationId || !user || !content.trim()) return

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    })

    if (error) {
      console.error('Failed to send message:', error)
    }
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (error) console.error('Failed to delete message:', error)
  }

  async function markAsRead() {
    if (!conversationId || !user) return
    const { error } = await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
    if (error) console.error('Failed to mark as read:', error)
  }

  return { messages, loading, sendMessage, deleteMessage, markAsRead }
}
