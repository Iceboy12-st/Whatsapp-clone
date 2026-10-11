import { useEffect, useState } from 'react'
import { usePrefs, WALLPAPERS } from '@/store/prefs'

export function useResolvedDark(): boolean {
  const theme = usePrefs((s) => s.theme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return theme === 'dark' || (theme === 'system' && systemDark)
}

export function useApplyTheme() {
  const dark = useResolvedDark()
  const wallpaper = usePrefs((s) => s.wallpaper)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    const wp = WALLPAPERS.find((w) => w.id === wallpaper) ?? WALLPAPERS[0]
    root.style.setProperty('--wa-wallpaper', dark ? wp.dark : wp.light)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#202c33' : '#f0f2f5')
  }, [dark, wallpaper])
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}
