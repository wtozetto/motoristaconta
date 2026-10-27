import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Registro } from '../types'
import { buildTips, evaluateTips } from './tips'

function row(data: string, ganhos: number, gastos: number, km = 50): Registro {
  return {
    id: data,
    data,
    kmInicial: 0,
    kmFinal: km,
    ganhos: { uber: ganhos, noventaenove: 0, indrive: 0 },
    combustivel: gastos,
    outrosGastos: 0,
    observacoes: '',
    atualizadoEm: data,
  }
}

describe('regras de dicas', () => {
  it('marca custo alto quando gastos > 30% dos ganhos', () => {
    const high = evaluateTips([row('2026-10-12', 100, 40)], DEFAULT_SETTINGS)
    expect(high.highCost).toBe(true)
    const ok = evaluateTips([row('2026-10-12', 100, 20)], DEFAULT_SETTINGS)
    expect(ok.highCost).toBe(false)
  })

  it('identifica o melhor dia da semana pelo lucro', () => {
    const monday = row('2026-10-12', 400, 50)
    const tuesday = row('2026-10-13', 100, 50)
    const result = evaluateTips([monday, tuesday], DEFAULT_SETTINGS)
    expect(result.bestWeekday).toBe(1)
  })

  it('compara plataformas', () => {
    const registro: Registro = {
      ...row('2026-10-14', 0, 10),
      ganhos: { uber: 80, noventaenove: 120, indrive: 40 },
    }
    const result = evaluateTips([registro], DEFAULT_SETTINGS)
    expect(result.topPlatform).toBe('noventaenove')
    expect(result.platformRank[0].key).toBe('noventaenove')
  })

  it('compara meta R$/km com a média real', () => {
    const below = evaluateTips([row('2026-10-14', 100, 0, 50)], {
      ...DEFAULT_SETTINGS,
      metaRsPorKm: 3,
    })
    expect(below.actualMediaPorKm).toBe(2)
    expect(below.metaStatus).toBe('below')

    const above = evaluateTips([row('2026-10-14', 200, 0, 50)], {
      ...DEFAULT_SETTINGS,
      metaRsPorKm: 3,
    })
    expect(above.metaStatus).toBe('above')
  })

  it('calcula reserva sugerida acumulada vs lucro', () => {
    const result = evaluateTips([row('2026-10-14', 1000, 200)], {
      ...DEFAULT_SETTINGS,
      reservaPercent: 15,
    })
    expect(result.suggestedReserve).toBe(150)
    expect(result.lucroLiquido).toBe(800)
    expect(result.canCoverReserve).toBe(true)

    const short = evaluateTips([row('2026-10-14', 100, 90)], DEFAULT_SETTINGS)
    expect(short.suggestedReserve).toBe(15)
    expect(short.canCoverReserve).toBe(false)
  })

  it('gera cartões para a UI', () => {
    const tips = buildTips([row('2026-10-14', 100, 40)], {
      ...DEFAULT_SETTINGS,
      metaRsPorKm: 10,
    })
    expect(tips.some((t) => t.id === 'custo-alto')).toBe(true)
    expect(tips.some((t) => t.id === 'reserva')).toBe(true)
    expect(tips.some((t) => t.id === 'meta')).toBe(true)
  })
})
