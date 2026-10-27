import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loadSettings, saveSettings } from '../settings/storage'
import type { AppSettings, ThemePreference } from '../types'

interface ThemeContextValue {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
  updateSettings: (patch: Partial<AppSettings>) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

function applyDomTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const resolvedTheme = resolveTheme(settings.theme)

  useEffect(() => {
    applyDomTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyDomTheme(resolveTheme('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const persist = useCallback((next: AppSettings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      persist({ ...settings, theme })
    },
    [persist, settings],
  )

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      persist({ ...settings, ...patch })
    },
    [persist, settings],
  )

  const value = useMemo(
    () => ({ settings, resolvedTheme, setTheme, updateSettings }),
    [settings, resolvedTheme, setTheme, updateSettings],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme precisa estar dentro de ThemeProvider')
  }
  return ctx
}
