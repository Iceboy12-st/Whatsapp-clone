import { create } from 'zustand'

interface PresenceState {
  online: Set<string>
  typing: Record<string, Record<string, number>>
  setOnline: (ids: string[]) => void
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void
}

export const usePresence = create<PresenceState>((set) => ({
  online: new Set(),
  typing: {},
  setOnline: (ids) => set({ online: new Set(ids) }),
  setTyping: (chatId, userId, isTyping) =>
    set((s) => {
      const chat = { ...(s.typing[chatId] ?? {}) }
      if (isTyping) chat[userId] = Date.now()
      else delete chat[userId]
      return { typing: { ...s.typing, [chatId]: chat } }
    }),
}))

export function useTypingUsers(chatId: string | null | undefined, excludeId?: string): string[] {
  const chat = usePresence((s) => (chatId ? s.typing[chatId] : undefined))
  if (!chat) return []
  const now = Date.now()
  return Object.entries(chat)
    .filter(([id, at]) => id !== excludeId && now - at < 6000)
    .map(([id]) => id)
}
