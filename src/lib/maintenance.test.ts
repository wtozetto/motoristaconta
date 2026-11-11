import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Manutencao, type Registro } from '../types'
import { calculateManutencaoMetrics, getKmAtual } from './maintenance'

const registro = (kmFinal: number, id: string): Registro =>
  ({
    id,
    data: '2026-10-14',
    kmInicial: 0,
    kmFinal,
    ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
    combustivel: 0,
    outrosGastos: 0,
    observacoes: '',
    atualizadoEm: '2026-10-14T12:00:00.000Z',
  }) as Registro

const manutencao = (kmRealizacao: number, id: string): Manutencao =>
  ({
    id,
    data: '2026-10-01',
    categoria: 'Troca de óleo',
    descricao: 'Teste',
    valor: 100,
    kmRealizacao,
    status: 'concluido',
    criadoEm: '2026-10-01T00:00:00.000Z',
    atualizadoEm: '2026-10-01T00:00:00.000Z',
  }) as Manutencao

describe('getKmAtual', () => {
  it('usa o maior KM final dos lançamentos', () => {
    expect(getKmAtual([registro(48_000, 'a'), registro(52_300, 'b')])).toBe(52_300)
  })

  it('considera também o KM de manutenções acima do último lançamento', () => {
    const km = getKmAtual([registro(52_300, 'a')], [manutencao(61_000, 'm1')])
    expect(km).toBe(61_000)
  })

  it('fallback para o maior KM de manutenções quando não há lançamentos', () => {
    expect(getKmAtual([], [manutencao(30_000, 'm1'), manutencao(41_200, 'm2')])).toBe(41_200)
  })

  it('retorna 0 sem nenhuma fonte', () => {
    expect(getKmAtual([], [])).toBe(0)
  })
})

describe('métricas de manutenção', () => {
  it('total investido soma apenas serviços concluídos', () => {
    const concluido: Manutencao = { ...manutencao(1_000, 'c1'), valor: 1_000 }
    const programado: Manutencao = {
      ...manutencao(5_000, 'p1'),
      status: 'programado',
      valor: 5_000,
    }
    const metrics = calculateManutencaoMetrics([concluido, programado], 5_000, DEFAULT_SETTINGS)
    expect(metrics.totalGasto).toBe(1_000)
    expect(metrics.porCategoria['Troca de óleo']).toBe(1_000)
    expect(metrics.totalItens).toBe(2)
  })
})
