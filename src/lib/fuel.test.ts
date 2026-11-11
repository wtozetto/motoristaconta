import { describe, expect, it } from 'vitest'
import type { Registro } from '../types'
import { calculateCombustivelMetrics } from './fuel'

const registro = (
  combustiveis: Registro['combustiveis'],
  kmFinal: number,
): Registro =>
  ({
    id: Math.random().toString(),
    data: '2026-10-14',
    kmInicial: 0,
    kmFinal,
    ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
    combustivel: { tipo: 'gasolina', valor: 0 },
    combustiveis,
    outrosGastos: 0,
    observacoes: '',
    atualizadoEm: '2026-10-14T12:00:00.000Z',
  }) as Registro

describe('métricas de combustível', () => {
  it('preço médio por litro ignora itens sem litragem', () => {
    const r1 = registro(
      [{ tipo: 'gasolina', valor: 100, litros: 20 }],
      100,
    )
    // Abastecimento de R$ 30 sem litros: entra no total, mas não no preço médio.
    const r2 = registro(
      [{ tipo: 'gasolina', valor: 30 }],
      200,
    )
    const metrics = calculateCombustivelMetrics([r1, r2], 200)
    expect(metrics.totalValor).toBe(130)
    expect(metrics.porTipo.gasolina.litros).toBe(20)
    expect(metrics.porTipo.gasolina.precoMedio).toBe(5)
  })
})
