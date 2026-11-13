import { afterEach, describe, expect, it } from 'vitest'
import { db, MotoristaDB, listRegistros, setDatabaseScope, upsertRegistro } from './database'
import type { Registro } from '../types'

const record = (id: string): Registro => ({
  id,
  data: '2026-11-13',
  kmInicial: 100,
  kmFinal: 120,
  ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
  combustivel: { tipo: 'nao_informado', valor: 0 },
  outrosGastos: 0,
  observacoes: '',
  atualizadoEm: new Date().toISOString(),
})

describe('isolamento do IndexedDB por conta', () => {
  const suffix = crypto.randomUUID()
  const owner = `owner-${suffix}`
  const other = `other-${suffix}`
  const legacyDb = new MotoristaDB()

  afterEach(async () => {
    db.close()
    legacyDb.close()
    localStorage.clear()
    await MotoristaDB.delete(`MotoristaConta:${encodeURIComponent(owner)}`)
    await MotoristaDB.delete(`MotoristaConta:${encodeURIComponent(other)}`)
    await MotoristaDB.delete('MotoristaConta')
  })

  it('migra a base legada somente para a identidade dona e separa as contas', async () => {
    await legacyDb.open()
    await legacyDb.registros.put(record('legacy-record'))
    localStorage.setItem('motoristaconta.legacyDataOwner', owner)

    await setDatabaseScope(owner)
    expect(await listRegistros()).toHaveLength(1)

    await setDatabaseScope(other)
    expect(await listRegistros()).toEqual([])
    await upsertRegistro(record('other-record'))

    await setDatabaseScope(owner)
    expect((await listRegistros()).map((item) => item.id)).toEqual(['legacy-record'])
  })
})
