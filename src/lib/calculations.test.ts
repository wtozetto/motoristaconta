import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Manutencao, type Registro } from '../types'
import {
  aggregateRegistros,
  calculateGoalProjection,
  deriveRegistro,
  trendDelta,
} from './calculations'
import { calculateCombustivelMetrics } from './fuel'
import { evaluateManutencaoAlerta } from './maintenance'
import { validateManutencao, validateRegistro } from './validation'

function sample(partial: Partial<Registro> = {}): Registro {
  return {
    id: 'r1',
    data: '2026-10-14',
    kmInicial: 100,
    kmFinal: 150,
    ganhos: { uber: 200, noventaenove: 100, indrive: 50 },
    combustivel: { tipo: 'gasolina', valor: 70, litros: 12 },
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
    const b = sample({
      id: 'b',
      data: '2026-10-14',
      ganhos: { uber: 80, noventaenove: 0, indrive: 0 },
    })
    const agg = aggregateRegistros([a, b], 'uber')
    expect(agg.totalGanhos).toBe(280)
    expect(agg.km).toBe(100)
    expect(agg.totalGastos).toBe(200)
  })
})

describe('validação de lançamentos e combustível', () => {
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
  })

  it('exige seleção de tipo (Etanol/Gasolina/Diesel) quando combustível > 0', () => {
    const errObj = validateRegistro({
      data: '2026-10-14',
      kmInicial: 100,
      kmFinal: 150,
      ganhos: { uber: 100, noventaenove: 0, indrive: 0 },
      combustivel: { tipo: 'nao_informado', valor: 80 },
    })
    expect(errObj.some((e) => e.includes('tipo de combustível'))).toBe(true)

    const errList = validateRegistro({
      data: '2026-10-14',
      kmInicial: 100,
      kmFinal: 150,
      ganhos: { uber: 100, noventaenove: 0, indrive: 0 },
      combustivel: 80,
      combustiveis: [{ tipo: 'nao_informado', valor: 80 }],
    })
    expect(errList.some((e) => e.includes('tipo de combustível'))).toBe(true)
  })

  it('aceita combustível com tipo válido (Etanol, Gasolina ou Diesel)', () => {
    for (const tipo of ['etanol', 'gasolina', 'diesel'] as const) {
      expect(
        validateRegistro({
          data: '2026-10-14',
          kmInicial: 100,
          kmFinal: 150,
          ganhos: { uber: 100, noventaenove: 0, indrive: 0 },
          combustivel: { tipo, valor: 80, litros: 15 },
        }),
      ).toEqual([])
    }
  })

  it('aceita registro com combustível 0 sem exigir tipo', () => {
    expect(
      validateRegistro({
        data: '2026-10-14',
        kmInicial: 100,
        kmFinal: 150,
        ganhos: { uber: 100, noventaenove: 0, indrive: 0 },
        combustivel: 0,
      }),
    ).toEqual([])
  })
})

describe('cálculo de métricas de combustível', () => {
  it('calcula total por tipo, preço médio por litro e autonomia km/l', () => {
    const r1 = sample({
      kmInicial: 0,
      kmFinal: 100,
      combustivel: { tipo: 'gasolina', valor: 100, litros: 20 },
      combustiveis: [{ tipo: 'gasolina', valor: 100, litros: 20 }],
    })
    const r2 = sample({
      kmInicial: 100,
      kmFinal: 200,
      combustivel: { tipo: 'etanol', valor: 70, litros: 20 },
      combustiveis: [{ tipo: 'etanol', valor: 70, litros: 20 }],
    })

    const metrics = calculateCombustivelMetrics([r1, r2], 200)

    expect(metrics.totalValor).toBe(170)
    expect(metrics.totalLitros).toBe(40)
    expect(metrics.custoPorKm).toBeCloseTo(170 / 200)

    expect(metrics.porTipo.gasolina.valor).toBe(100)
    expect(metrics.porTipo.gasolina.litros).toBe(20)
    expect(metrics.porTipo.gasolina.precoMedio).toBe(5)
    expect(metrics.porTipo.gasolina.kmPorLitro).toBe(5) // 100 km / 20 L

    expect(metrics.porTipo.etanol.valor).toBe(70)
    expect(metrics.porTipo.etanol.litros).toBe(20)
    expect(metrics.porTipo.etanol.precoMedio).toBe(3.5)
    expect(metrics.porTipo.etanol.kmPorLitro).toBe(5)
  })
})

describe('validação de manutenção', () => {
  it('exige pelo menos próxima data ou próximo km', () => {
    const errors = validateManutencao({
      data: '2026-10-14',
      categoria: 'Troca de óleo',
      descricao: 'Troca de óleo e filtro',
      valor: 200,
      kmRealizacao: 50000,
      status: 'concluido',
    })
    expect(errors.some((e) => e.includes('Informe a data ou o KM'))).toBe(true)
  })

  it('rejeita próximo KM menor ou igual ao de realização', () => {
    const errors = validateManutencao({
      data: '2026-10-14',
      categoria: 'Troca de óleo',
      descricao: 'Troca de óleo e filtro',
      valor: 200,
      kmRealizacao: 50000,
      proximaKm: 49000,
      status: 'concluido',
    })
    expect(errors.some((e) => e.includes('maior que o KM de realização'))).toBe(true)
  })

  it('aceita manutenção válida com próxima data ou próximo KM', () => {
    expect(
      validateManutencao({
        data: '2026-10-14',
        categoria: 'Freios',
        descricao: 'Pastilhas dianteiras trocadas',
        valor: 350,
        kmRealizacao: 50000,
        proximaKm: 70000,
        status: 'concluido',
      }),
    ).toEqual([])
  })
})

describe('alertas inteligentes de manutenção', () => {
  const baseManutencao: Manutencao = {
    id: 'm1',
    data: '2026-10-01',
    categoria: 'Troca de óleo',
    descricao: 'Óleo 5W30',
    valor: 200,
    kmRealizacao: 50000,
    proximaData: '2026-11-20',
    proximaKm: 60000,
    status: 'concluido',
    criadoEm: '2026-10-01',
    atualizadoEm: '2026-10-01',
  }

  it('alerta 🟢 Ok quando distante do limite por data e km', () => {
    const hoje = '2026-10-14'
    const kmAtual = 55000 // Faltam 5000 km e 37 dias
    const alerta = evaluateManutencaoAlerta(baseManutencao, kmAtual, DEFAULT_SETTINGS, hoje)
    expect(alerta.status).toBe('ok')
  })

  it('alerta 🟡 Próximo quando faltam menos de 500 km ou menos de 30 dias', () => {
    const hoje = '2026-11-01' // faltam 19 dias (<= 30 dias)
    const kmAtual = 55000
    const alertaData = evaluateManutencaoAlerta(baseManutencao, kmAtual, DEFAULT_SETTINGS, hoje)
    expect(alertaData.status).toBe('proximo')

    const alertaKm = evaluateManutencaoAlerta(
      baseManutencao,
      59600, // faltam 400 km (<= 500 km)
      DEFAULT_SETTINGS,
      '2026-10-14',
    )
    expect(alertaKm.status).toBe('proximo')
  })

  it('alerta 🔴 Atrasado quando passou da data ou ultrapassou o KM', () => {
    // Passou da data
    const alertaData = evaluateManutencaoAlerta(
      baseManutencao,
      55000,
      DEFAULT_SETTINGS,
      '2026-11-25',
    )
    expect(alertaData.status).toBe('atrasado')

    // Ultrapassou o KM
    const alertaKm = evaluateManutencaoAlerta(
      baseManutencao,
      60100,
      DEFAULT_SETTINGS,
      '2026-10-14',
    )
    expect(alertaKm.status).toBe('atrasado')
  })
})

describe('tendência', () => {
  it('calcula variação percentual', () => {
    expect(trendDelta(120, 100)).toBeCloseTo(0.2)
    expect(trendDelta(0, 0)).toBe(0)
    expect(trendDelta(10, 0)).toBeNull()
  })

  describe('projeção da meta mensal', () => {
    it('calcula saldo, média necessária por dia e previsão no ritmo atual', () => {
      expect(calculateGoalProjection(600, 1200, 10, 20)).toEqual({
        remaining: 600,
        dailyRequired: 30,
        daysToGoal: 10,
      })
    })

    it('lida com meta atingida e com nenhum ganho registrado', () => {
      expect(calculateGoalProjection(1200, 1200, 10, 20).daysToGoal).toBe(0)
      expect(calculateGoalProjection(0, 1200, 0, 20).daysToGoal).toBeNull()
    })
  })
})
