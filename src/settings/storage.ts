import { DEFAULT_SETTINGS, type AppSettings } from '../types'

export const SETTINGS_STORAGE_KEY = 'motoristaconta.settings'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      metaRsPorKm: Number(parsed.metaRsPorKm ?? DEFAULT_SETTINGS.metaRsPorKm),
      reservaPercent: Number(parsed.reservaPercent ?? DEFAULT_SETTINGS.reservaPercent),
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
