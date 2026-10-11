import { useEffect, useMemo, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { chatTitle, isMuted, messagePreview } from '@/lib/utils'
import { useChats } from '@/store/chats'
import { usePrefs } from '@/store/prefs'
import { usePresence } from '@/store/presence'
import { useUI } from '@/store/ui'
import type { Message, Profile } from '@/types'

const typingChannels = new Map<string, RealtimeChannel>()
const lastTypingSent = new Map<string, number>()

export function sendTyping(chatId: string, userId: string, isTyping: boolean) {
  const ch = typingChannels.get(chatId)
  if (!ch) return
  const now = Date.now()
  if (isTyping && now - (lastTypingSent.get(chatId) ?? 0) < 2500) return
  lastTypingSent.set(chatId, isTyping ? now : 0)
  void ch.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping } })
}

function playPing() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio unavailable */
  }
}

function notify(m: Message, userId: string) {
  if (m.sender_id === userId || m.type === 'system') return
  const chat = useChats.getState().chats.find((c) => c.id === m.conversation_id)
  if (!chat || isMuted(chat)) return
  const prefs = usePrefs.getState()
  const isActive = useUI.getState().activeChatId === m.conversation_id
  const focused = document.visibilityState === 'visible' && document.hasFocus()
  if (focused && isActive) return
  if (prefs.sounds) playPing()
  if (!prefs.notifications || focused || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const sender = chat.members.find((x) => x.profile.id === m.sender_id)?.profile.display_name
  const title = chat.is_group ? `${chatTitle(chat)}` : chatTitle(chat)
  const body = prefs.notificationPreviews ? `${chat.is_group && sender ? `${sender}: ` : ''}${messagePreview(m)}` : 'New message'
  const n = new Notification(title, { body, tag: m.conversation_id, icon: '/whatsapp.svg' })
  n.onclick = () => {
    window.focus()
    useUI.getState().openChat(m.conversation_id)
    n.close()
  }
}

export function useRealtimeSync(me: Profile) {
  const userId = me.id
  const chats = useChats((s) => s.chats)
  const reloadTimer = useRef<number>()

  useEffect(() => {
    const { load, loadBlocked, loadStarred } = useChats.getState()
    void load(userId).then(() => supabase.rpc('mark_delivered'))
    void loadBlocked(userId)
    void loadStarred(userId)
    const reload = () => {
      window.clearTimeout(reloadTimer.current)
      reloadTimer.current = window.setTimeout(() => void useChats.getState().load(userId), 300)
    }
    const channel = supabase
      .channel(`sync:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Message
        const state = useChats.getState()
        if (!state.chats.some((c) => c.id === m.conversation_id)) {
          reload()
          return
        }
        state.onMessage(m, userId, useUI.getState().activeChatId)
        notify(m, userId)
        if (m.sender_id !== userId) void supabase.rpc('mark_delivered')
        if (m.type === 'system') reload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new as Message
        const chat = useChats.getState().chats.find((c) => c.id === m.conversation_id)
        if (chat?.last_message?.id === m.id) useChats.getState().patchChat(chat.id, { last_message: m })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, reload)
      .subscribe()
    const onFocus = () => reload()
    window.addEventListener('online', onFocus)
    return () => {
      window.clearTimeout(reloadTimer.current)
      window.removeEventListener('online', onFocus)
      void supabase.removeChannel(channel)
      useChats.getState().reset()
    }
  }, [userId])

  useEffect(() => {
    const channel = supabase.channel('presence:online', { config: { presence: { key: userId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        usePresence.getState().setOnline(Object.keys(channel.presenceState()))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && me.show_online) void channel.track({ at: Date.now() })
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, me.show_online])

  const chatIdsKey = useMemo(() => chats.map((c) => c.id).sort().join(','), [chats])
  useEffect(() => {
    const ids = chatIdsKey ? chatIdsKey.split(',') : []
    for (const id of ids) {
      if (typingChannels.has(id)) continue
      const ch = supabase.channel(`typing:${id}`)
      ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
        const { userId: from, isTyping } = payload as { userId: string; isTyping: boolean }
        if (from === userId) return
        usePresence.getState().setTyping(id, from, isTyping)
        if (isTyping) window.setTimeout(() => usePresence.getState().setTyping(id, from, false), 6000)
      }).subscribe()
      typingChannels.set(id, ch)
    }
    for (const [id, ch] of typingChannels) {
      if (!ids.includes(id)) {
        void supabase.removeChannel(ch)
        typingChannels.delete(id)
      }
    }
  }, [chatIdsKey, userId])

  useEffect(
    () => () => {
      for (const ch of typingChannels.values()) void supabase.removeChannel(ch)
      typingChannels.clear()
    },
    [],
  )
}
