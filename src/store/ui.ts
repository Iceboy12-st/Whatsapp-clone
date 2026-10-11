import { create } from 'zustand'
import type { UIMessage } from '@/types'

export type LeftView =
  | 'chats'
  | 'archived'
  | 'starred'
  | 'new-chat'
  | 'new-group'
  | 'status'
  | 'communities'
  | 'settings'
  | 'profile'

export type RightPanel = 'info' | 'search' | 'starred' | null

export interface CallState {
  chatId: string
  video: boolean
}

export interface LightboxState {
  messages: UIMessage[]
  index: number
}

export type DialogState =
  | { kind: 'forward'; messages: UIMessage[] }
  | { kind: 'message-info'; message: UIMessage }
  | { kind: 'shortcuts' }
  | { kind: 'confirm'; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void> }
  | null

interface UIState {
  activeChatId: string | null
  leftView: LeftView
  rightPanel: RightPanel
  call: CallState | null
  lightbox: LightboxState | null
  dialog: DialogState
  pendingSearch: string | null
  listSearchFocusTick: number
  openChat: (id: string | null) => void
  setLeftView: (v: LeftView) => void
  setRightPanel: (p: RightPanel) => void
  toggleRightPanel: (p: Exclude<RightPanel, null>) => void
  setCall: (c: CallState | null) => void
  setLightbox: (l: LightboxState | null) => void
  setDialog: (d: DialogState) => void
  searchInChat: (chatId: string, q: string) => void
  clearPendingSearch: () => void
  focusListSearch: () => void
}

export const useUI = create<UIState>((set, get) => ({
  activeChatId: null,
  leftView: 'chats',
  rightPanel: null,
  call: null,
  lightbox: null,
  dialog: null,
  pendingSearch: null,
  listSearchFocusTick: 0,
  openChat: (id) =>
    set((s) => ({ activeChatId: id, rightPanel: id === s.activeChatId ? s.rightPanel : null })),
  setLeftView: (v) => set({ leftView: v }),
  setRightPanel: (p) => set({ rightPanel: p }),
  toggleRightPanel: (p) => set({ rightPanel: get().rightPanel === p ? null : p }),
  setCall: (c) => set({ call: c }),
  setLightbox: (l) => set({ lightbox: l }),
  setDialog: (d) => set({ dialog: d }),
  searchInChat: (chatId, q) => set({ activeChatId: chatId, rightPanel: 'search', pendingSearch: q }),
  clearPendingSearch: () => set({ pendingSearch: null }),
  focusListSearch: () => set((s) => ({ leftView: 'chats', listSearchFocusTick: s.listSearchFocusTick + 1 })),
}))
