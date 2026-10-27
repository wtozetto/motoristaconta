import { describe, expect, it } from 'vitest'
import type { Registro } from '../types'
import { aggregateRegistros, deriveRegistro, trendDelta } from './calculations'
import { validateRegistro } from './validation'

function sample(partial: Partial<Registro> = {}): Registro {
  return {
    id: 'r1',
    data: '2026-10-14',
    kmInicial: 100,
    kmFinal: 150,
    ganhos: { uber: 200, noventaenove: 100, indrive: 50 },
    combustivel: 70,
    outrosGastos: 30,
    observacoes: '',
    atualizadoEm: '2026-10-14T12:00:00.000Z',
    ...partial,
  }
}

describe('fórmulas', () => {
  it('calcula km, ganhos, gastos, lucro e médias com números de exemplo', () => {
    const d = deriveRegistro(sample())
    expect(d.km).toBe(50)
    expect(d.totalGanhos).toBe(350)
    expect(d.totalGastos).toBe(100)
    expect(d.lucroLiquido).toBe(250)
    expect(d.mediaGanhoPorKm).toBe(7)
    expect(d.custoPorKm).toBe(2)
    expect(d.lucroPorKm).toBe(5)
    expect(d.shares.uber).toBeCloseTo(200 / 350)
    expect(d.shares.noventaenove).toBeCloseTo(100 / 350)
    expect(d.shares.indrive).toBeCloseTo(50 / 350)
  })

  it('retorna médias 0 quando km é 0', () => {
    const d = deriveRegistro(sample({ kmInicial: 10, kmFinal: 10 }))
    expect(d.km).toBe(0)
    expect(d.mediaGanhoPorKm).toBe(0)
    expect(d.custoPorKm).toBe(0)
    expect(d.lucroPorKm).toBe(0)
  })

  it('trata outrosGastos ausente como 0', () => {
    const d = deriveRegistro(sample({ outrosGastos: undefined as unknown as number }))
    expect(d.totalGastos).toBe(70)
  })
})

describe('filtro de plataforma', () => {
  it('usa só os ganhos do app e mantém km e gastos do dia', () => {
    const uber = deriveRegistro(sample(), 'uber')
    expect(uber.totalGanhos).toBe(200)
    expect(uber.km).toBe(50)
    expect(uber.totalGastos).toBe(100)
    expect(uber.lucroLiquido).toBe(100)
    expect(uber.mediaGanhoPorKm).toBe(4)
    expect(uber.custoPorKm).toBe(2)
    expect(uber.lucroPorKm).toBe(2)

    const n99 = deriveRegistro(sample(), 'noventaenove')
    expect(n99.totalGanhos).toBe(100)
    expect(n99.totalGastos).toBe(100)
    expect(n99.lucroLiquido).toBe(0)

    const indrive = deriveRegistro(sample(), 'indrive')
    expect(indrive.totalGanhos).toBe(50)
    expect(indrive.lucroLiquido).toBe(-50)
  })

  it('agrega vários dias com o mesmo filtro', () => {
    const a = sample({ id: 'a', data: '2026-10-13' })
    const b = sample({ id: 'b', data: '2026-10-14', ganhos: { uber: 80, noventaenove: 0, indrive: 0 } })
    const agg = aggregateRegistros([a, b], 'uber')
    expect(agg.totalGanhos).toBe(280)
    expect(agg.km).toBe(100)
    expect(agg.totalGastos).toBe(200)
  })
})

describe('validação', () => {
  it('bloqueia km final menor que inicial', () => {
    const errors = validateRegistro({
      data: '2026-10-14',
      kmInicial: 100,
      kmFinal: 90,
      ganhos: { uber: 10, noventaenove: 0, indrive: 0 },
      combustivel: 0,
    })
    expect(errors.some((e) => e.includes('KM final'))).toBe(true)
  })

  it('bloqueia valores negativos', () => {
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: -1,
        kmFinal: 10,
        ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
        combustivel: 0,
      }).length,
    ).toBeGreaterThan(0)
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: 0,
        kmFinal: 10,
        ganhos: { uber: -5, noventaenove: 0, indrive: 0 },
        combustivel: 0,
      }).length,
    ).toBeGreaterThan(0)
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: 0,
        kmFinal: 10,
        ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
        combustivel: -1,
      }).length,
    ).toBeGreaterThan(0)
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: 0,
        kmFinal: 10,
        ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
        combustivel: 0,
        outrosGastos: -2,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('aceita registro válido', () => {
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: 100,
        kmFinal: 150,
        ganhos: { uber: 1, noventaenove: 0, indrive: 0 },
        combustivel: 0,
        outrosGastos: 0,
      }),
    ).toEqual([])
  })
})

describe('tendência', () => {
  it('calcula variação percentual', () => {
    expect(trendDelta(120, 100)).toBeCloseTo(0.2)
    expect(trendDelta(0, 0)).toBe(0)
    expect(trendDelta(10, 0)).toBeNull()
  })
})
