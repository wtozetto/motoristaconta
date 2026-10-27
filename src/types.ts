export type PlatformKey = 'uber' | 'noventaenove' | 'indrive'

export type PlatformFilter = 'todas' | PlatformKey

export type PeriodPreset =
  | 'diario'
  | 'semanal'
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'
  | 'custom'

export interface Ganhos {
  uber: number
  noventaenove: number
  indrive: number
}

export interface Registro {
  id: string
  data: string
  kmInicial: number
  kmFinal: number
  ganhos: Ganhos
  combustivel: number
  outrosGastos: number
  observacoes: string
  atualizadoEm: string
}

export interface RegistroInput {
  data: string
  kmInicial: number
  kmFinal: number
  ganhos: Ganhos
  combustivel: number
  outrosGastos?: number
  observacoes?: string
}

export interface DerivedMetrics {
  km: number
  totalGanhos: number
  totalGastos: number
  lucroLiquido: number
  mediaGanhoPorKm: number
  custoPorKm: number
  lucroPorKm: number
  shares: Ganhos
}

export interface GoogleSession {
  googleId: string
  name: string
  email: string
  lastAccessAt: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface AppSettings {
  metaRsPorKm: number
  reservaPercent: number
  theme: ThemePreference
}

export const BACKUP_VERSION = 1 as const

export interface BackupPayload {
  version: typeof BACKUP_VERSION
  app: 'MotoristaConta'
  exportedAt: string
  settings: AppSettings
  registros: Registro[]
}

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  uber: 'Uber',
  noventaenove: '99',
  indrive: 'Indrive',
}

export const DEFAULT_SETTINGS: AppSettings = {
  metaRsPorKm: 0,
  reservaPercent: 15,
  theme: 'system',
}
