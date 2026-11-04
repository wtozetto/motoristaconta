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

export type CombustivelTipo = 'etanol' | 'gasolina' | 'diesel' | 'nao_informado'

export interface CombustivelItem {
  tipo: CombustivelTipo
  valor: number
  litros?: number
}

export interface CombustivelData {
  tipo: CombustivelTipo | 'multiplo'
  valor: number
  litros?: number
}

export interface Registro {
  id: string
  data: string
  kmInicial: number
  kmFinal: number
  ganhos: Ganhos
  combustivel: CombustivelData | number
  combustiveis?: CombustivelItem[]
  outrosGastos: number
  observacoes: string
  atualizadoEm: string
}

export interface RegistroInput {
  data: string
  kmInicial: number
  kmFinal: number
  ganhos: Ganhos
  combustivel: CombustivelData | number
  combustiveis?: CombustivelItem[]
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

export const BACKUP_VERSION = 2 as const

export interface BackupPayload {
  version: number
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

export const COMBUSTIVEL_LABEL: Record<CombustivelTipo, string> = {
  etanol: 'Etanol',
  gasolina: 'Gasolina',
  diesel: 'Diesel',
  nao_informado: 'Não informado',
}

export const COMBUSTIVEL_COLORS: Record<CombustivelTipo, string> = {
  etanol: '#16a34a',
  gasolina: '#dc2626',
  diesel: '#2563eb',
  nao_informado: '#94a3b8',
}

export const DEFAULT_SETTINGS: AppSettings = {
  metaRsPorKm: 0,
  reservaPercent: 15,
  theme: 'system',
}
