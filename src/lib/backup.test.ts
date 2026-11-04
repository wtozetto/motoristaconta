import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Registro } from '../types'
import { applyImport, backupToJson, parseBackupJson } from './backup'

const older: Registro = {
  id: 'same',
  data: '2026-10-01',
  kmInicial: 0,
  kmFinal: 10,
  ganhos: { uber: 10, noventaenove: 0, indrive: 0 },
  combustivel: { tipo: 'gasolina', valor: 50, litros: 8.5 },
  combustiveis: [{ tipo: 'gasolina', valor: 50, litros: 8.5 }],
  outrosGastos: 0,
  observacoes: 'old',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
}

const newer: Registro = {
  ...older,
  observacoes: 'new',
  atualizadoEm: '2026-10-02T10:00:00.000Z',
}

describe('JSON import/export', () => {
  it('preserva integridade no roundtrip com schema v2 e tipo de combustível', () => {
    const json = backupToJson([older], DEFAULT_SETTINGS, '2026-10-14T00:00:00.000Z')
    const parsed = parseBackupJson(json)
    expect(parsed.registros).toEqual([older])
    expect(parsed.settings.reservaPercent).toBe(15)
    expect(parsed.app).toBe('MotoristaConta')
    expect(JSON.parse(json).version).toBe(2)
  })

  it('migra retrocompativelmente registros antigos com combustivel numérico', () => {
    const legacyRaw = JSON.stringify({
      version: 1,
      app: 'MotoristaConta',
      exportedAt: '2026-10-01T00:00:00.000Z',
      settings: DEFAULT_SETTINGS,
      registros: [
        {
          id: 'leg1',
          data: '2026-09-01',
          kmInicial: 1000,
          kmFinal: 1200,
          ganhos: { uber: 300, noventaenove: 0, indrive: 0 },
          combustivel: 80,
          outrosGastos: 10,
          observacoes: 'legado',
          atualizadoEm: '2026-09-01T20:00:00.000Z',
        },
      ],
    })

    const parsed = parseBackupJson(legacyRaw)
    expect(parsed.registros).toHaveLength(1)
    const reg = parsed.registros[0]
    expect(reg.combustivel).toEqual({
      tipo: 'nao_informado',
      valor: 80,
      litros: undefined,
    })
    expect(reg.combustiveis).toEqual([
      {
        tipo: 'nao_informado',
        valor: 80,
      },
    ])
  })

  it('no merge, atualizadoEm mais recente vence', () => {
    const merged = applyImport([older], [newer], 'merge')
    expect(merged).toHaveLength(1)
    expect(merged[0].observacoes).toBe('new')
  })

  it('no merge, não sobrescreve com versão mais antiga', () => {
    const merged = applyImport([newer], [older], 'merge')
    expect(merged[0].observacoes).toBe('new')
  })

  it('no merge, inclui ids novos', () => {
    const extra: Registro = { ...older, id: 'other', observacoes: 'extra' }
    const merged = applyImport([older], [extra], 'merge')
    expect(merged.map((r) => r.id).sort()).toEqual(['other', 'same'])
  })

  it('replace descarta os registros atuais', () => {
    const extra: Registro = { ...older, id: 'incoming-only' }
    const replaced = applyImport([older, newer], [extra], 'replace')
    expect(replaced).toEqual([extra])
  })
})
