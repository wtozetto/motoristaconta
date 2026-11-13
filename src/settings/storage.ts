import { DEFAULT_SETTINGS, type AppSettings } from '../types'

export const SETTINGS_STORAGE_KEY = 'motoristaconta.settings'

function scopedKey(scope: string): string {
  return scope ? `${SETTINGS_STORAGE_KEY}.${encodeURIComponent(scope)}` : SETTINGS_STORAGE_KEY
}

export function loadSettings(scope = ''): AppSettings {
  try {
    const key = scopedKey(scope)
    let raw = localStorage.getItem(key)
    if (!raw && scope && localStorage.getItem('motoristaconta.legacyDataOwner') === scope) {
      raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (raw) localStorage.setItem(key, raw)
    }
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      metaRsPorKm: Number(parsed.metaRsPorKm ?? DEFAULT_SETTINGS.metaRsPorKm),
      reservaPercent: Number(parsed.reservaPercent ?? DEFAULT_SETTINGS.reservaPercent),
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      alertaManutencaoDias: Number(
        parsed.alertaManutencaoDias ?? DEFAULT_SETTINGS.alertaManutencaoDias,
      ),
      alertaManutencaoKm: Number(
        parsed.alertaManutencaoKm ?? DEFAULT_SETTINGS.alertaManutencaoKm,
      ),
      metaMensal: Number(parsed.metaMensal ?? DEFAULT_SETTINGS.metaMensal),
      lembreteRegistroDiario:
        parsed.lembreteRegistroDiario ?? DEFAULT_SETTINGS.lembreteRegistroDiario,
      gastosFixosMensais: Number(parsed.gastosFixosMensais ?? DEFAULT_SETTINGS.gastosFixosMensais),
      notificacoesVencimento:
        parsed.notificacoesVencimento ?? DEFAULT_SETTINGS.notificacoesVencimento,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings, scope = ''): void {
  localStorage.setItem(scopedKey(scope), JSON.stringify(settings))
}
