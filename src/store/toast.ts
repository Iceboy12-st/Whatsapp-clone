import { create } from 'zustand'
import { errorMessage } from '@/lib/supabase'

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'default') => {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] })
    setTimeout(() => get().dismiss(id), tone === 'error' ? 5000 : 3000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (message: string) => useToasts.getState().push(message)
export const toastError = (error: unknown) => useToasts.getState().push(errorMessage(error), 'error')
