import Dexie, { type Table } from 'dexie'
import type { Registro } from '../types'

export class MotoristaDB extends Dexie {
  registros!: Table<Registro, string>

  constructor() {
    super('MotoristaConta')
    this.version(1).stores({
      registros: 'id, data, atualizadoEm',
    })
  }
}

export const db = new MotoristaDB()

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
