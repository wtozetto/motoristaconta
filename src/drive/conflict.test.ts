import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type BackupPayload, type Registro } from '../types'
import { backupStamp, decideSync } from './conflict'

const registro = (id: string, at: string): Registro => ({
  id,
  data: '2026-10-01',
  kmInicial: 0,
  kmFinal: 10,
  ganhos: { uber: 10, noventaenove: 0, indrive: 0 },
  combustivel: 1,
  outrosGastos: 0,
  observacoes: '',
  atualizadoEm: at,
})

function payload(rows: Registro[], exportedAt: string): BackupPayload {
  return {
    version: 1,
    app: 'MotoristaConta',
    exportedAt,
    settings: DEFAULT_SETTINGS,
    registros: rows,
  }
}

describe('decideSync', () => {
  it('restaura quando o aparelho está vazio e o Drive tem dados', () => {
    const remote = payload([registro('a', '2026-10-02T00:00:00.000Z')], '2026-10-02T00:00:00.000Z')
    expect(decideSync(0, '', remote)).toBe('restore')
  })

  it('mantém local quando o Drive está vazio', () => {
    expect(decideSync(2, '2026-10-02T00:00:00.000Z', null)).toBe('keep-local')
  })

  it('restaura se o Drive for mais recente', () => {
    const remote = payload([registro('a', '2026-10-03T00:00:00.000Z')], '2026-10-01T00:00:00.000Z')
    expect(decideSync(1, '2026-10-02T00:00:00.000Z', remote)).toBe('restore')
  })

  it('envia o local se ele for mais novo ou igual', () => {
    const remote = payload([registro('a', '2026-10-01T00:00:00.000Z')], '2026-10-01T00:00:00.000Z')
    expect(decideSync(1, '2026-10-02T00:00:00.000Z', remote)).toBe('keep-local')
  })
})

describe('backupStamp', () => {
  it('usa o maior entre exportedAt e atualizadoEm', () => {
    const remote = payload([registro('a', '2026-10-09T00:00:00.000Z')], '2026-10-01T00:00:00.000Z')
    expect(backupStamp(remote)).toBe('2026-10-09T00:00:00.000Z')
  })
})
