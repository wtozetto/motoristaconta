export type SeguroSubcategoria = 'mensalidade' | 'franquia'

export interface ContaFixa {
  id: string
  titulo: string
  tipo: 'seguro' | 'ipva' | 'licenciamento' | 'parcelas' | 'troca_oleo' | 'revisao' | 'outros'
  valor: number
  dataVencimento: string
  observacao: string
  status: 'pendente' | 'pago'
  criadoEm: string
  atualizadoEm: string
}

export interface ContaFixaInput {
  titulo: string
  tipo: ContaFixa['tipo']
  valor: number
  dataVencimento: string
  observacao?: string
  status: ContaFixa['status']
}

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
  etiquetas?: string[]  // "feriado", "corrida especial", "aeroporto", etc.
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
  etiquetas?: string[]
}

export const MANUTENCAO_CATEGORIAS = [
  'Troca de óleo',
  'Filtros',
  'Pneus/rodízio/alinhamento',
  'Freios',
  'Suspensão',
  'Correia dentada',
  'Embreagem',
  'Bateria',
  'Velas/ignição',
  'Ar-condicionado',
  'Revisão geral',
  'Seguro',
  'Outros',
] as const

export type ManutencaoCategoria = (typeof MANUTENCAO_CATEGORIAS)[number] | string

export type ManutencaoStatus = 'concluido' | 'programado'

export interface Manutencao {
  id: string
  data: string
  categoria: ManutencaoCategoria
  seguroSubcategoria?: SeguroSubcategoria
  descricao: string
  valor: number
  kmRealizacao: number
  proximaData?: string
  proximaKm?: number
  oficina?: string
  observacoes?: string
  status: ManutencaoStatus
  criadoEm: string
  atualizadoEm: string
}

export interface ManutencaoInput {
  data: string
  categoria: ManutencaoCategoria
  seguroSubcategoria?: SeguroSubcategoria
  descricao: string
  valor: number
  kmRealizacao: number
  proximaData?: string
  proximaKm?: number
  oficina?: string
  observacoes?: string
  status: ManutencaoStatus
}

export type AlertaStatus = 'atrasado' | 'proximo' | 'ok'

export interface ManutencaoAlerta {
  manutencao: Manutencao
  status: AlertaStatus
  mensagem: string
  detalhe?: string
  diasRestantes?: number
  kmRestantes?: number
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
  supabaseUserId?: string
  role?: 'admin' | 'driver'
  accessBlocked?: boolean
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface AppSettings {
  metaRsPorKm: number
  reservaPercent: number
  theme: ThemePreference
  alertaManutencaoDias: number
  alertaManutencaoKm: number
  metaMensal: number          // monthly goal in R$, default 0 (disabled)
  lembreteRegistroDiario: boolean  // daily reminder toggle, default false
  gastosFixosMensais: number  // total fixed monthly expenses (seguro+IPVA+depreciacao), default 0
  notificacoesVencimento: boolean
}

export const BACKUP_VERSION = 2 as const

export interface BackupPayload {
  version: number
  app: 'MotoristaConta'
  exportedAt: string
  ultimaModificacao?: string
  ultimaSincronizacao?: string
  versaoSchema?: number
  settings: AppSettings
  registros: Registro[]
  manutencoes?: Manutencao[]
  contasFixas?: ContaFixa[]
  categoriasManutencao?: string[]
  categoriasManutencaoAtualizadoEm?: string
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
  metaRsPorKm: 2.5,
  reservaPercent: 15,
  theme: 'system',
  alertaManutencaoDias: 30,
  alertaManutencaoKm: 500,
  metaMensal: 0,
  lembreteRegistroDiario: false,
  gastosFixosMensais: 0,
  notificacoesVencimento: true,
}
