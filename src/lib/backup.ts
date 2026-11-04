import {
  BACKUP_VERSION,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BackupPayload,
  type CombustivelData,
  type CombustivelItem,
  type Manutencao,
  type Registro,
} from '../types'
import { buildCombustivelAggregate } from './fuel'

export type ImportMode = 'merge' | 'replace'

export function serializeBackup(
  registros: Registro[],
  settings: AppSettings,
  manutencoesOrExportedAt?: Manutencao[] | string,
  exportedAtArg?: string,
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

  return {
    version: BACKUP_VERSION,
    app: 'MotoristaConta',
    exportedAt,
    settings,
    registros: structuredClone(registros),
    manutencoes: structuredClone(manutencoes),
  }
}

export function backupToJson(
  registros: Registro[],
  settings: AppSettings,
  manutencoesOrExportedAt?: Manutencao[] | string,
  exportedAt?: string,
): string {
  return JSON.stringify(
    serializeBackup(registros, settings, manutencoesOrExportedAt, exportedAt),
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
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings ?? {}),
  }
  return {
    version: typeof data.version === 'number' ? data.version : BACKUP_VERSION,
    app: 'MotoristaConta',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    settings,
    registros,
    manutencoes,
  }
}

export function normalizeRegistro(item: unknown, index = 0): Registro {
  if (!item || typeof item !== 'object') {
    throw new Error(`Registro inválido na posição ${index + 1}.`)
  }
  const r = item as Partial<Registro>
  const ganhos = r.ganhos ?? { uber: 0, noventaenove: 0, indrive: 0 }

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

  return {
    id: String(r.id ?? crypto.randomUUID()),
    data: String(r.data ?? ''),
    kmInicial: Number(r.kmInicial ?? 0),
    kmFinal: Number(r.kmFinal ?? 0),
    ganhos: {
      uber: Number(ganhos.uber ?? 0),
      noventaenove: Number(ganhos.noventaenove ?? 0),
      indrive: Number(ganhos.indrive ?? 0),
    },
    combustivel,
    combustiveis,
    outrosGastos: Number(r.outrosGastos ?? 0),
    observacoes: String(r.observacoes ?? ''),
    atualizadoEm: String(r.atualizadoEm ?? new Date().toISOString()),
  }
}

export function normalizeManutencao(item: unknown, index = 0): Manutencao {
  if (!item || typeof item !== 'object') {
    throw new Error(`Manutenção inválida na posição ${index + 1}.`)
  }
  const m = item as Partial<Manutencao>
  return {
    id: String(m.id ?? crypto.randomUUID()),
    data: String(m.data ?? ''),
    categoria: String(m.categoria ?? 'Outros'),
    descricao: String(m.descricao ?? ''),
    valor: Number(m.valor ?? 0),
    kmRealizacao: Number(m.kmRealizacao ?? 0),
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
