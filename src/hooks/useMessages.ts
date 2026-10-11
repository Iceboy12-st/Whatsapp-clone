import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildPath, uploadWithProgress } from '@/lib/storage'
import { uuid } from '@/lib/utils'
import { useChats } from '@/store/chats'
import { toastError } from '@/store/toast'
import type { ChatItem, Message, MessageRead, MessageType, Reaction, UIMessage } from '@/types'

export const PAGE_SIZE = 50

export interface SendInput {
  text: string
  type?: MessageType
  file?: File | Blob
  fileName?: string
  duration?: number
  replyToId?: string | null
  forwarded?: boolean
}

function mediaType(file: File | Blob): MessageType {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

export async function insertMessage(chatId: string, senderId: string, input: SendInput, clientId = uuid(), onProgress?: (p: number) => void): Promise<Message> {
  let media_url: string | null = null
  let type: MessageType = input.type ?? 'text'
  if (input.file) {
    type = input.type ?? mediaType(input.file)
    const path = buildPath(chatId, input.file, type === 'audio' ? 'webm' : 'bin')
    media_url = await uploadWithProgress('chat-media', path, input.file, onProgress)
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: chatId,
      sender_id: senderId,
      content: input.text,
      type,
      media_url,
      media_name: input.fileName ?? (input.file instanceof File ? input.file.name : null),
      media_size: input.file?.size ?? null,
      media_mime: input.file?.type || null,
      duration: input.duration ?? null,
      reply_to_id: input.replyToId ?? null,
      forwarded: input.forwarded ?? false,
      client_id: clientId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Message
}

function mergeMessages(list: UIMessage[], incoming: UIMessage[]): UIMessage[] {
  const byKey = new Map<string, UIMessage>()
  for (const m of list) byKey.set(m.client_id ?? m.id, m)
  for (const m of incoming) {
    const key = m.client_id ?? m.id
    const prev = byKey.get(key)
    byKey.set(key, prev?.localUrl && !m.localUrl ? { ...m, localUrl: prev.localUrl } : m)
  }
  return [...byKey.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function useMessages(chat: ChatItem | null, userId: string, active: boolean) {
  const chatId = chat?.id ?? null
  const clearedAt = chat?.me.cleared_at ?? null
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({})
  const [reads, setReads] = useState<Record<string, MessageRead[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hidden = useRef<Set<string>>(new Set())
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const fetchExtras = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const [r, rd] = await Promise.all([
      supabase.from('message_reactions').select('*').in('message_id', ids),
      supabase.from('message_reads').select('*').in('message_id', ids),
    ])
    setReactions((prev) => {
      const next = { ...prev }
      for (const id of ids) delete next[id]
      for (const x of (r.data ?? []) as Reaction[]) (next[x.message_id] ??= []).push(x)
      return next
    })
    setReads((prev) => {
      const next = { ...prev }
      for (const x of (rd.data ?? []) as MessageRead[]) {
        next[x.message_id] = [...(next[x.message_id] ?? []).filter((y) => y.user_id !== x.user_id), x]
      }
      return next
    })
  }, [])

  const fetchPage = useCallback(
    async (before?: string) => {
      if (!chatId) return []
      let q = supabase.from('messages').select('*').eq('conversation_id', chatId).order('created_at', { ascending: false }).limit(PAGE_SIZE)
      if (before) q = q.lt('created_at', before)
      if (clearedAt) q = q.gt('created_at', clearedAt)
      const { data, error: err } = await q
      if (err) throw err
      const rows = (data ?? []) as Message[]
      setHasMore(rows.length === PAGE_SIZE)
      const visible = rows.filter((m) => !hidden.current.has(m.id)).reverse()
      void fetchExtras(visible.map((m) => m.id))
      return visible
    },
    [chatId, clearedAt, fetchExtras],
  )

  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    setMessages([])
    setReactions({})
    setReads({})
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const { data: del } = await supabase.from('message_deletions').select('message_id').eq('conversation_id', chatId).eq('user_id', userId)
        hidden.current = new Set((del ?? []).map((d) => d.message_id as string))
        const page = await fetchPage()
        if (!cancelled) setMessages(page)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load messages')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatId, userId, fetchPage])

  useEffect(() => {
    if (!chatId) return
    const channel = supabase
      .channel(`chat-msgs:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` }, (p) => {
        const m = p.new as Message
        if (clearedAt && m.created_at <= clearedAt) return
        setMessages((prev) => mergeMessages(prev, [m]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` }, (p) => {
        const m = p.new as Message
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${chatId}` }, (p) => {
        const id = (p.old as { id: string }).id
        setMessages((prev) => prev.filter((x) => x.id !== id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `conversation_id=eq.${chatId}` }, (p) => {
        const row = (p.eventType === 'DELETE' ? p.old : p.new) as Reaction
        setReactions((prev) => {
          const list = (prev[row.message_id] ?? []).filter((r) => r.user_id !== row.user_id)
          return { ...prev, [row.message_id]: p.eventType === 'DELETE' ? list : [...list, row] }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads', filter: `conversation_id=eq.${chatId}` }, (p) => {
        const row = p.new as MessageRead
        if (!row?.message_id) return
        setReads((prev) => ({ ...prev, [row.message_id]: [...(prev[row.message_id] ?? []).filter((r) => r.user_id !== row.user_id), row] }))
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [chatId, clearedAt])

  const lastIncomingId = [...messages].reverse().find((m) => m.sender_id !== userId && m.type !== 'system')?.id
  useEffect(() => {
    if (!chatId || !active || loading) return
    const mark = () => {
      if (document.visibilityState !== 'visible') return
      void supabase.rpc('mark_conversation_read', { _cid: chatId })
      useChats.getState().patchChat(chatId, { unread_count: 0 })
    }
    mark()
    document.addEventListener('visibilitychange', mark)
    return () => document.removeEventListener('visibilitychange', mark)
  }, [chatId, active, loading, lastIncomingId])

  const loadOlder = useCallback(async () => {
    const first = messagesRef.current.find((m) => !m.localStatus)
    if (!first || loadingOlder || !hasMore) return
    setLoadingOlder(true)
    try {
      const page = await fetchPage(first.created_at)
      setMessages((prev) => mergeMessages(prev, page))
    } catch (e) {
      toastError(e)
    } finally {
      setLoadingOlder(false)
    }
  }, [fetchPage, hasMore, loadingOlder])

  const runSend = useCallback(
    async (optimistic: UIMessage, input: SendInput) => {
      if (!chatId) return
      try {
        const saved = await insertMessage(chatId, userId, input, optimistic.client_id!, (progress) =>
          setMessages((prev) => prev.map((m) => (m.client_id === optimistic.client_id ? { ...m, progress } : m))),
        )
        setMessages((prev) => mergeMessages(prev, [{ ...saved, localUrl: optimistic.localUrl }]))
        useChats.getState().onMessage(saved, userId, chatId)
      } catch (e) {
        setMessages((prev) => prev.map((m) => (m.client_id === optimistic.client_id ? { ...m, localStatus: 'failed', progress: undefined } : m)))
        toastError(e)
      }
    },
    [chatId, userId],
  )

  const send = useCallback(
    (input: SendInput) => {
      if (!chatId) return
      const clientId = uuid()
      const file = input.file
      const optimistic: UIMessage = {
        id: clientId,
        client_id: clientId,
        conversation_id: chatId,
        sender_id: userId,
        content: input.text,
        created_at: new Date().toISOString(),
        type: input.type ?? (file ? mediaType(file) : 'text'),
        media_url: null,
        media_name: input.fileName ?? (file instanceof File ? file.name : null),
        media_size: file?.size ?? null,
        media_mime: file?.type ?? null,
        duration: input.duration ?? null,
        reply_to_id: input.replyToId ?? null,
        forwarded: input.forwarded ?? false,
        edited_at: null,
        deleted_for_everyone: false,
        localStatus: 'pending',
        localUrl: file ? URL.createObjectURL(file) : undefined,
        localFile: file instanceof File ? file : undefined,
        progress: file ? 0 : undefined,
      }
      setMessages((prev) => [...prev, optimistic])
      void runSend(optimistic, input)
      pendingInputs.set(clientId, input)
    },
    [chatId, userId, runSend],
  )

  const retry = useCallback(
    (m: UIMessage) => {
      const input = m.client_id ? pendingInputs.get(m.client_id) : undefined
      if (!input) return
      setMessages((prev) => prev.map((x) => (x.client_id === m.client_id ? { ...x, localStatus: 'pending', progress: input.file ? 0 : undefined } : x)))
      void runSend(m, input)
    },
    [runSend],
  )

  const discard = useCallback((m: UIMessage) => {
    setMessages((prev) => prev.filter((x) => x.client_id !== m.client_id))
  }, [])

  const edit = useCallback(async (m: UIMessage, content: string) => {
    const edited_at = new Date().toISOString()
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content, edited_at } : x)))
    const { error: err } = await supabase.from('messages').update({ content, edited_at }).eq('id', m.id)
    if (err) {
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)))
      toastError(err)
    }
  }, [])

  const deleteForMe = useCallback(
    async (list: UIMessage[]) => {
      if (!chatId) return
      const ids = list.filter((m) => !m.localStatus).map((m) => m.id)
      ids.forEach((id) => hidden.current.add(id))
      setMessages((prev) => prev.filter((x) => !list.some((m) => m.id === x.id)))
      if (ids.length === 0) return
      const { error: err } = await supabase
        .from('message_deletions')
        .upsert(ids.map((message_id) => ({ message_id, user_id: userId, conversation_id: chatId })))
      if (err) toastError(err)
      void useChats.getState().load(userId)
    },
    [chatId, userId],
  )

  const deleteForEveryone = useCallback(async (list: UIMessage[]) => {
    const ids = list.map((m) => m.id)
    setMessages((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, deleted_for_everyone: true, content: '', media_url: null } : x)))
    const { error: err } = await supabase
      .from('messages')
      .update({ deleted_for_everyone: true, content: '', media_url: null, media_name: null })
      .in('id', ids)
    if (err) toastError(err)
  }, [])

  const react = useCallback(
    async (m: UIMessage, emoji: string) => {
      if (!chatId) return
      const mine = reactions[m.id]?.find((r) => r.user_id === userId)
      const removing = mine?.emoji === emoji
      setReactions((prev) => {
        const list = (prev[m.id] ?? []).filter((r) => r.user_id !== userId)
        return {
          ...prev,
          [m.id]: removing ? list : [...list, { message_id: m.id, user_id: userId, conversation_id: chatId, emoji, created_at: new Date().toISOString() }],
        }
      })
      const { error: err } = removing
        ? await supabase.from('message_reactions').delete().eq('message_id', m.id).eq('user_id', userId)
        : await supabase.from('message_reactions').upsert({ message_id: m.id, user_id: userId, conversation_id: chatId, emoji })
      if (err) toastError(err)
    },
    [chatId, reactions, userId],
  )

  return {
    messages,
    reactions,
    reads,
    loading,
    loadingOlder,
    hasMore,
    error,
    loadOlder,
    send,
    retry,
    discard,
    edit,
    deleteForMe,
    deleteForEveryone,
    react,
  }
}

const pendingInputs = new Map<string, SendInput>()

export async function toggleStar(m: Message, userId: string) {
  const { starred } = useChats.getState()
  const isStarred = starred.has(m.id)
  const next = new Set(starred)
  if (isStarred) next.delete(m.id)
  else next.add(m.id)
  useChats.setState({ starred: next })
  const { error } = isStarred
    ? await supabase.from('starred_messages').delete().eq('message_id', m.id).eq('user_id', userId)
    : await supabase.from('starred_messages').insert({ message_id: m.id, user_id: userId, conversation_id: m.conversation_id })
  if (error) {
    useChats.setState({ starred })
    toastError(error)
  }
}
