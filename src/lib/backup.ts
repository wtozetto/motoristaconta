import {
  BACKUP_VERSION,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BackupPayload,
  type Registro,
} from '../types'

export type ImportMode = 'merge' | 'replace'

export function serializeBackup(
  registros: Registro[],
  settings: AppSettings,
  exportedAt = new Date().toISOString(),
): BackupPayload {
  return {
    version: BACKUP_VERSION,
    app: 'MotoristaConta',
    exportedAt,
    settings,
    registros: structuredClone(registros),
  }
}

export function backupToJson(
  registros: Registro[],
  settings: AppSettings,
  exportedAt?: string,
): string {
  return JSON.stringify(serializeBackup(registros, settings, exportedAt), null, 2)
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
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(data.settings ?? {}),
  }
  return {
    version: BACKUP_VERSION,
    app: 'MotoristaConta',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    settings,
    registros,
  }
}

function normalizeRegistro(item: unknown, index: number): Registro {
  if (!item || typeof item !== 'object') {
    throw new Error(`Registro inválido na posição ${index + 1}.`)
  }
  const r = item as Partial<Registro>
  const ganhos = r.ganhos ?? { uber: 0, noventaenove: 0, indrive: 0 }
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
    combustivel: Number(r.combustivel ?? 0),
    outrosGastos: Number(r.outrosGastos ?? 0),
    observacoes: String(r.observacoes ?? ''),
    atualizadoEm: String(r.atualizadoEm ?? new Date().toISOString()),
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
