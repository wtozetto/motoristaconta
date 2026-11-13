import {
  BACKUP_VERSION,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BackupPayload,
  type ContaFixa,
  type CombustivelData,
  type CombustivelItem,
  type Manutencao,
  type Registro,
} from '../types'
import { buildCombustivelAggregate } from './fuel'

export type ImportMode = 'merge' | 'replace'

export function getLatestRecordStamp(data: {
  registros?: Registro[]
  manutencoes?: Manutencao[]
  contasFixas?: ContaFixa[]
}): string {
  let max = ''
  if (data.registros) {
    for (const r of data.registros) {
      if (r.atualizadoEm && r.atualizadoEm > max) max = r.atualizadoEm
    }
  }
  if (data.manutencoes) {
    for (const m of data.manutencoes) {
      if (m.atualizadoEm && m.atualizadoEm > max) max = m.atualizadoEm
    }
  }
  if (data.contasFixas) {
    for (const conta of data.contasFixas) {
      if (conta.atualizadoEm && conta.atualizadoEm > max) max = conta.atualizadoEm
    }
  }
  return max
}

export function serializeBackup(
  registros: Registro[],
  settings: AppSettings,
  manutencoesOrExportedAt?: Manutencao[] | string,
  exportedAtArg?: string,
  ultimaModificacao?: string,
  ultimaSincronizacao?: string,
  contasFixas: ContaFixa[] = [],
): BackupPayload {
  let manutencoes: Manutencao[] = []
  let exportedAt = new Date().toISOString()

  if (typeof manutencoesOrExportedAt === 'string') {
    exportedAt = manutencoesOrExportedAt
  } else if (Array.isArray(manutencoesOrExportedAt)) {
    manutencoes = manutencoesOrExportedAt
    if (exportedAtArg) exportedAt = exportedAtArg
  } else if (exportedAtArg) {
    exportedAt = exportedAtArg
  }

  const recStamp = getLatestRecordStamp({ registros, manutencoes, contasFixas })
  const modStamp = ultimaModificacao || recStamp || exportedAt

  return {
    version: BACKUP_VERSION,
    versaoSchema: BACKUP_VERSION,
    app: 'MotoristaConta',
    exportedAt,
    ultimaModificacao: modStamp,
    ultimaSincronizacao: ultimaSincronizacao || exportedAt,
    settings,
    registros: structuredClone(registros),
    manutencoes: structuredClone(manutencoes),
    contasFixas: structuredClone(contasFixas),
  }
}

export function backupToJson(
  registros: Registro[],
  settings: AppSettings,
  manutencoesOrExportedAt?: Manutencao[] | string,
  exportedAt?: string,
  ultimaModificacao?: string,
  ultimaSincronizacao?: string,
  contasFixas: ContaFixa[] = [],
): string {
  return JSON.stringify(
    serializeBackup(
      registros,
      settings,
      manutencoesOrExportedAt,
      exportedAt,
      ultimaModificacao,
      ultimaSincronizacao,
      contasFixas,
    ),
    null,
    2,
  )
}

export function parseBackupJson(raw: string): BackupPayload {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Arquivo JSON inválido.')
  }
  const data = parsed as Partial<BackupPayload>
  if (!Array.isArray(data.registros)) {
    throw new Error('JSON sem lista de registros.')
  }
  const registros = data.registros.map(normalizeRegistro)
  const manutencoes = Array.isArray(data.manutencoes)
    ? data.manutencoes.map(normalizeManutencao)
    : []
  const contasFixas = Array.isArray(data.contasFixas)
    ? data.contasFixas.map(normalizeContaFixa)
    : []
  const settings: AppSettings = normalizeSettings(data.settings)
  const exportedAt =
    typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString()
  const ultimaSincronizacao =
    typeof data.ultimaSincronizacao === 'string' ? data.ultimaSincronizacao : exportedAt
  const ultimaModificacao =
    typeof data.ultimaModificacao === 'string'
      ? data.ultimaModificacao
      : ultimaSincronizacao
  const versaoSchema =
    typeof data.versaoSchema === 'number'
      ? data.versaoSchema
      : typeof data.version === 'number'
        ? data.version
        : BACKUP_VERSION

  return {
    version: typeof data.version === 'number' ? data.version : BACKUP_VERSION,
    versaoSchema,
    app: 'MotoristaConta',
    exportedAt,
    ultimaModificacao,
    ultimaSincronizacao,
    settings,
    registros,
    manutencoes,
    contasFixas,
  }
}

function normalizeSettings(raw: unknown): AppSettings {
  const parsed =
    raw && typeof raw === 'object' ? (raw as Partial<AppSettings>) : {}
  const num = (value: unknown, fallback: number): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  const reserva = Math.min(100, Math.max(0, num(parsed.reservaPercent, DEFAULT_SETTINGS.reservaPercent)))
  return {
    metaRsPorKm: Math.max(0, num(parsed.metaRsPorKm, DEFAULT_SETTINGS.metaRsPorKm)),
    reservaPercent: reserva,
    theme:
      parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
        ? parsed.theme
        : DEFAULT_SETTINGS.theme,
    alertaManutencaoDias: Math.max(1, Math.round(num(parsed.alertaManutencaoDias, DEFAULT_SETTINGS.alertaManutencaoDias))),
    alertaManutencaoKm: Math.max(0, Math.round(num(parsed.alertaManutencaoKm, DEFAULT_SETTINGS.alertaManutencaoKm))),
    metaMensal: Math.max(0, num(parsed.metaMensal, DEFAULT_SETTINGS.metaMensal)),
    lembreteRegistroDiario:
      typeof parsed.lembreteRegistroDiario === 'boolean'
        ? parsed.lembreteRegistroDiario
        : DEFAULT_SETTINGS.lembreteRegistroDiario,
    gastosFixosMensais: Math.max(0, num(parsed.gastosFixosMensais, DEFAULT_SETTINGS.gastosFixosMensais)),
    notificacoesVencimento:
      typeof parsed.notificacoesVencimento === 'boolean'
        ? parsed.notificacoesVencimento
        : DEFAULT_SETTINGS.notificacoesVencimento,
  }
}
export function normalizeRegistro(item: unknown, index = 0): Registro {
  if (!item || typeof item !== 'object') {
    throw new Error(`Registro inválido na posição ${index + 1}.`)
  }
  const r = item as Partial<Registro>
  const ganhos =
    r.ganhos && typeof r.ganhos === 'object'
      ? (r.ganhos as Registro['ganhos'])
      : { uber: 0, noventaenove: 0, indrive: 0 }

  let combustivel: CombustivelData
  let combustiveis: CombustivelItem[] | undefined

  if (Array.isArray(r.combustiveis) && r.combustiveis.length > 0) {
    combustiveis = r.combustiveis.map((c) => ({
      tipo: c.tipo ?? 'nao_informado',
      valor: Number(c.valor ?? 0),
      litros: c.litros !== undefined && c.litros > 0 ? Number(c.litros) : undefined,
    }))
    const agg = buildCombustivelAggregate(combustiveis)
    combustivel = agg.combustivel
  } else if (typeof r.combustivel === 'object' && r.combustivel !== null) {
    const c = r.combustivel as CombustivelData
    combustivel = {
      tipo: c.tipo ?? 'nao_informado',
      valor: Number(c.valor ?? 0),
      litros: c.litros !== undefined && c.litros > 0 ? Number(c.litros) : undefined,
    }
    combustiveis = [
      {
        tipo: combustivel.tipo === 'multiplo' ? 'nao_informado' : combustivel.tipo,
        valor: combustivel.valor,
        litros: combustivel.litros,
      },
    ]
  } else {
    // Retrocompatibilidade: valor antigo numérico
    const valor = Number(r.combustivel ?? 0)
    combustivel = {
      tipo: 'nao_informado',
      valor,
      litros: undefined,
    }
    combustiveis = [{ tipo: 'nao_informado', valor }]
  }

  const num = (value: unknown, fallback = 0): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    id: String(r.id ?? crypto.randomUUID()),
    data: String(r.data ?? ''),
    kmInicial: Math.max(0, num(r.kmInicial)),
    kmFinal: Math.max(0, num(r.kmFinal)),
    ganhos: {
      uber: Math.max(0, num(ganhos.uber)),
      noventaenove: Math.max(0, num(ganhos.noventaenove)),
      indrive: Math.max(0, num(ganhos.indrive)),
    },
    combustivel,
    combustiveis,
    outrosGastos: Math.max(0, num(r.outrosGastos)),
    observacoes: String(r.observacoes ?? ''),
    atualizadoEm: String(r.atualizadoEm ?? new Date().toISOString()),
  }
}

export function normalizeManutencao(item: unknown, index = 0): Manutencao {
  if (!item || typeof item !== 'object') {
    throw new Error(`Manutenção inválida na posição ${index + 1}.`)
  }
  const m = item as Partial<Manutencao>
  const num = (value: unknown, fallback = 0): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  return {
    id: String(m.id ?? crypto.randomUUID()),
    data: String(m.data ?? ''),
    categoria: String(m.categoria ?? 'Outros'),
    seguroSubcategoria:
      m.seguroSubcategoria === 'mensalidade' || m.seguroSubcategoria === 'franquia'
        ? m.seguroSubcategoria
        : undefined,
    descricao: String(m.descricao ?? ''),
    valor: Math.max(0, num(m.valor)),
    kmRealizacao: Math.max(0, num(m.kmRealizacao)),
    proximaData: m.proximaData ? String(m.proximaData) : undefined,
    proximaKm:
      m.proximaKm !== undefined && m.proximaKm !== null && !isNaN(Number(m.proximaKm))
        ? Number(m.proximaKm)
        : undefined,
    oficina: m.oficina ? String(m.oficina) : undefined,
    observacoes: m.observacoes ? String(m.observacoes) : undefined,
    status: m.status === 'programado' ? 'programado' : 'concluido',
    criadoEm: String(m.criadoEm ?? new Date().toISOString()),
    atualizadoEm: String(m.atualizadoEm ?? new Date().toISOString()),
  }
}

function normalizeContaFixa(item: unknown, index = 0): ContaFixa {
  if (!item || typeof item !== 'object') {
    throw new Error(`Vencimento inválido na posição ${index + 1}.`)
  }
  const conta = item as Partial<ContaFixa>
  const value = Number(conta.valor ?? 0)
  const titulo = String(conta.titulo ?? '').trim()
  const dataVencimento = String(conta.dataVencimento ?? '')
  const validTypes: ContaFixa['tipo'][] = [
    'seguro',
    'ipva',
    'licenciamento',
    'parcelas',
    'troca_oleo',
    'revisao',
    'outros',
  ]
  const parsedDate = new Date(`${dataVencimento}T00:00:00Z`)
  if (!titulo) throw new Error(`Título inválido no vencimento ${index + 1}.`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== dataVencimento
  ) {
    throw new Error(`Data inválida no vencimento ${index + 1}.`)
  }
  return {
    id: String(conta.id ?? crypto.randomUUID()),
    titulo,
    tipo: validTypes.includes(conta.tipo ?? 'outros') ? conta.tipo ?? 'outros' : 'outros',
    valor: Number.isFinite(value) ? Math.max(0, value) : 0,
    dataVencimento,
    observacao: String(conta.observacao ?? ''),
    status: conta.status === 'pago' ? 'pago' : 'pendente',
    criadoEm: String(conta.criadoEm ?? new Date().toISOString()),
    atualizadoEm: String(conta.atualizadoEm ?? new Date().toISOString()),
  }
}

export function applyImport(
  existing: Registro[],
  incoming: Registro[],
  mode: ImportMode,
): Registro[] {
  if (mode === 'replace') {
    return incoming.map((r) => ({ ...r }))
  }
  const map = new Map(existing.map((r) => [r.id, r]))
  for (const row of incoming) {
    const prev = map.get(row.id)
    if (!prev || row.atualizadoEm >= prev.atualizadoEm) {
      map.set(row.id, { ...row })
    }
  }
  return [...map.values()].sort((a, b) => b.data.localeCompare(a.data))
}

export function applyImportManutencoes(
  existing: Manutencao[],
  incoming: Manutencao[],
  mode: ImportMode,
): Manutencao[] {
  if (mode === 'replace') {
    return incoming.map((m) => ({ ...m }))
  }
  const map = new Map(existing.map((m) => [m.id, m]))
  for (const row of incoming) {
    const prev = map.get(row.id)
    if (!prev || row.atualizadoEm >= prev.atualizadoEm) {
      map.set(row.id, { ...row })
    }
  }
  return [...map.values()].sort((a, b) => b.data.localeCompare(a.data))
}

export function applyImportContasFixas(
  existing: ContaFixa[],
  incoming: ContaFixa[],
  mode: ImportMode,
): ContaFixa[] {
  if (mode === 'replace') return incoming.map((conta) => ({ ...conta }))
  const map = new Map(existing.map((conta) => [conta.id, conta]))
  for (const conta of incoming) {
    const previous = map.get(conta.id)
    if (!previous || conta.atualizadoEm >= previous.atualizadoEm) {
      map.set(conta.id, { ...conta })
    }
  }
  return [...map.values()].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
}
