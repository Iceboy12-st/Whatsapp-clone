import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePref = 'light' | 'dark' | 'system'

export const WALLPAPERS = [
  { id: 'default', light: '#efeae2', dark: '#0b141a', label: 'Default' },
  { id: 'mint', light: '#d4ece0', dark: '#0f2a22', label: 'Mint' },
  { id: 'sky', light: '#d6e6f2', dark: '#0d1f2d', label: 'Sky' },
  { id: 'sand', light: '#f2e5cf', dark: '#2a2214', label: 'Sand' },
  { id: 'rose', light: '#f4dcdc', dark: '#2d1518', label: 'Rose' },
  { id: 'lavender', light: '#e3dcf2', dark: '#1d172b', label: 'Lavender' },
  { id: 'slate', light: '#d9dee2', dark: '#161c20', label: 'Slate' },
  { id: 'olive', light: '#e2e6cf', dark: '#1e2112', label: 'Olive' },
] as const

export type WallpaperId = (typeof WALLPAPERS)[number]['id']

interface PrefsState {
  theme: ThemePref
  wallpaper: WallpaperId
  doodles: boolean
  notifications: boolean
  notificationPreviews: boolean
  sounds: boolean
  enterToSend: boolean
  set: (patch: Partial<Omit<PrefsState, 'set'>>) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'light',
      wallpaper: 'default',
      doodles: true,
      notifications: true,
      notificationPreviews: true,
      sounds: true,
      enterToSend: true,
      set: (patch) => set(patch),
    }),
    { name: 'wa-prefs' },
  ),
)
