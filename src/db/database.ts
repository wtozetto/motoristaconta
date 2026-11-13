import Dexie, { type Table } from 'dexie'
import type { ContaFixa, Manutencao, Registro } from '../types'

export class MotoristaDB extends Dexie {
  registros!: Table<Registro, string>
  manutencoes!: Table<Manutencao, string>
  contasFixas!: Table<ContaFixa, string>
  categoriasManutencao!: Table<{ id: string; nome: string }, string>

  constructor(name = 'MotoristaConta') {
    super(name)
    this.version(1).stores({
      registros: 'id, data, atualizadoEm',
    })
    this.version(2).stores({
      registros: 'id, data, atualizadoEm',
      manutencoes: 'id, data, status, atualizadoEm',
    })
    this.version(3).stores({
      registros: 'id, data, atualizadoEm',
      manutencoes: 'id, data, status, atualizadoEm',
      contasFixas: 'id, dataVencimento, status, atualizadoEm',
    })
    this.version(4).stores({
      registros: 'id, data, atualizadoEm',
      manutencoes: 'id, data, status, atualizadoEm',
      contasFixas: 'id, dataVencimento, status, atualizadoEm',
      categoriasManutencao: 'id, nome',
    })
  }
}

export let db = new MotoristaDB()
let activeScope = ''

export async function setDatabaseScope(scope: string): Promise<void> {
  const normalized = scope.trim() || 'anonymous'
  if (activeScope === normalized) return

  db.close()
  db = new MotoristaDB(`MotoristaConta:${encodeURIComponent(normalized)}`)
  activeScope = normalized
  await db.open()

  const legacyOwner = localStorage.getItem('motoristaconta.legacyDataOwner')
  const migratedKey = `motoristaconta.legacyDataMigrated:${normalized}`
  if (legacyOwner !== normalized || localStorage.getItem(migratedKey)) return

  const legacy = new MotoristaDB()
  try {
    await legacy.open()
    const [records, maintenance, bills, categories] = await Promise.all([
      legacy.registros.toArray(),
      legacy.manutencoes.toArray(),
      legacy.contasFixas.toArray(),
      legacy.categoriasManutencao.toArray(),
    ])
    const [recordCount, maintenanceCount, billCount, categoryCount] = await Promise.all([
      db.registros.count(),
      db.manutencoes.count(),
      db.contasFixas.count(),
      db.categoriasManutencao.count(),
    ])
    if (recordCount + maintenanceCount + billCount + categoryCount === 0) {
      await db.transaction('rw', db.registros, db.manutencoes, db.contasFixas, db.categoriasManutencao, async () => {
        if (records.length) await db.registros.bulkPut(records)
        if (maintenance.length) await db.manutencoes.bulkPut(maintenance)
        if (bills.length) await db.contasFixas.bulkPut(bills)
        if (categories.length) await db.categoriasManutencao.bulkPut(categories)
      })
    }
    localStorage.setItem(migratedKey, 'true')
  } finally {
    legacy.close()
  }
}

export async function listRegistros(): Promise<Registro[]> {
  return db.registros.orderBy('data').reverse().toArray()
}

export async function upsertRegistro(registro: Registro): Promise<void> {
  await db.registros.put(registro)
}

export async function deleteRegistro(id: string): Promise<void> {
  await db.registros.delete(id)
}

export async function replaceAllRegistros(registros: Registro[]): Promise<void> {
  await db.transaction('rw', db.registros, async () => {
    await db.registros.clear()
    if (registros.length > 0) {
      await db.registros.bulkPut(registros)
    }
  })
}

export async function mergeRegistros(incoming: Registro[]): Promise<void> {
  const existing = await db.registros.toArray()
  const map = new Map(existing.map((r) => [r.id, r]))
  for (const row of incoming) {
    const prev = map.get(row.id)
    if (!prev || row.atualizadoEm >= prev.atualizadoEm) {
      map.set(row.id, row)
    }
  }
  await db.transaction('rw', db.registros, async () => {
    await db.registros.clear()
    const next = [...map.values()]
    if (next.length > 0) {
      await db.registros.bulkPut(next)
    }
  })
}

export async function listManutencoes(): Promise<Manutencao[]> {
  return db.manutencoes.orderBy('data').reverse().toArray()
}

export async function upsertManutencao(manutencao: Manutencao): Promise<void> {
  await db.manutencoes.put(manutencao)
}

export async function deleteManutencao(id: string): Promise<void> {
  await db.manutencoes.delete(id)
}

export async function replaceAllManutencoes(manutencoes: Manutencao[]): Promise<void> {
  await db.transaction('rw', db.manutencoes, async () => {
    await db.manutencoes.clear()
    if (manutencoes.length > 0) {
      await db.manutencoes.bulkPut(manutencoes)
    }
  })
}

export async function mergeManutencoes(incoming: Manutencao[]): Promise<void> {
  const existing = await db.manutencoes.toArray()
  const map = new Map(existing.map((m) => [m.id, m]))
  for (const row of incoming) {
    const prev = map.get(row.id)
    if (!prev || row.atualizadoEm >= prev.atualizadoEm) {
      map.set(row.id, row)
    }
  }
  await db.transaction('rw', db.manutencoes, async () => {
    await db.manutencoes.clear()
    const next = [...map.values()]
    if (next.length > 0) {
      await db.manutencoes.bulkPut(next)
    }
  })
}

export async function listContasFixas(): Promise<ContaFixa[]> {
  return db.contasFixas.orderBy('dataVencimento').toArray()
}

export async function upsertContaFixa(conta: ContaFixa): Promise<void> {
  await db.contasFixas.put(conta)
}

export async function deleteContaFixa(id: string): Promise<void> {
  await db.contasFixas.delete(id)
}

export async function replaceAllContasFixas(contas: ContaFixa[]): Promise<void> {
  await db.transaction('rw', db.contasFixas, async () => {
    await db.contasFixas.clear()
    if (contas.length > 0) await db.contasFixas.bulkPut(contas)
  })
}

export async function mergeContasFixas(incoming: ContaFixa[]): Promise<void> {
  const existing = await db.contasFixas.toArray()
  const map = new Map(existing.map((conta) => [conta.id, conta]))
  for (const conta of incoming) {
    const previous = map.get(conta.id)
    if (!previous || conta.atualizadoEm >= previous.atualizadoEm) map.set(conta.id, conta)
  }
  await replaceAllContasFixas([...map.values()])
}

export async function listCategoriasManutencao(): Promise<string[]> {
  const rows = await db.categoriasManutencao.orderBy('nome').toArray()
  return rows.map((row) => row.nome)
}

export async function replaceCategoriasManutencao(categorias: string[]): Promise<void> {
  const unique = [
    ...new Map(
      categorias
        .map((nome) => nome.trim())
        .filter(Boolean)
        .map((nome) => [nome.toLocaleLowerCase(), nome]),
    ).values(),
  ]
  await db.transaction('rw', db.categoriasManutencao, async () => {
    await db.categoriasManutencao.clear()
    if (unique.length > 0) {
      await db.categoriasManutencao.bulkPut(
        unique.map((nome) => ({ id: nome.toLocaleLowerCase(), nome })),
      )
    }
  })
}
