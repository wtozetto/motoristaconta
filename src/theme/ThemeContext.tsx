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
import { setLocalModificacaoStamp } from '../drive/syncStorage'
import type { AppSettings, ThemePreference } from '../types'
import { useAuth } from '../auth/AuthContext'

interface ThemeContextValue {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemePreference) => void
  updateSettings: (patch: Partial<AppSettings>) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyDomTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const scope = session?.googleId === 'dev-bypass' ? '' : session?.googleId ?? ''
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(scope))
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const resolvedTheme = settings.theme === 'system' ? systemTheme : settings.theme

  useEffect(() => {
    applyDomTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    setSettings(loadSettings(scope))
  }, [scope])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const persist = useCallback((next: AppSettings) => {
    setSettings(next)
    saveSettings(next, scope)
    // Preferências locais alteradas também contam como modificação: evita que a
    // sincronização use um carimbo antigo e prefira a versão remota.
    setLocalModificacaoStamp(new Date().toISOString())
  }, [scope])

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
