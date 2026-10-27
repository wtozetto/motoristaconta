import { describe, expect, it } from 'vitest'
import type { PeriodPreset, Registro } from '../types'
import {
  getPeriodRange,
  groupKeyFor,
  groupRegistros,
  previousRange,
} from './periods'

const NOW = new Date(2026, 9, 14)

describe('intervalos dos 7 períodos', () => {
  it('Diário, Semanal, Mensal, Bimestral, Trimestral, Semestral e Anual', () => {
    expect(getPeriodRange('diario', NOW)).toEqual({ start: '2026-10-14', end: '2026-10-14' })
    expect(getPeriodRange('semanal', NOW)).toEqual({ start: '2026-10-12', end: '2026-10-14' })
    expect(getPeriodRange('mensal', NOW)).toEqual({ start: '2026-10-01', end: '2026-10-14' })
    expect(getPeriodRange('bimestral', NOW)).toEqual({ start: '2026-09-01', end: '2026-10-14' })
    expect(getPeriodRange('trimestral', NOW)).toEqual({ start: '2026-10-01', end: '2026-10-14' })
    expect(getPeriodRange('semestral', NOW)).toEqual({ start: '2026-07-01', end: '2026-10-14' })
    expect(getPeriodRange('anual', NOW)).toEqual({ start: '2026-01-01', end: '2026-10-14' })
  })

  it('personalizado usa o intervalo informado', () => {
    expect(
      getPeriodRange('custom', NOW, { start: '2026-08-01', end: '2026-08-15' }),
    ).toEqual({ start: '2026-08-01', end: '2026-08-15' })
  })
})

describe('agrupamento', () => {
  const presets: { preset: PeriodPreset; date: string; key: string }[] = [
    { preset: 'diario', date: '2026-10-14', key: '2026-10-14' },
    { preset: 'semanal', date: '2026-10-14', key: '2026-10-12' },
    { preset: 'mensal', date: '2026-10-14', key: '2026-10' },
    { preset: 'bimestral', date: '2026-10-14', key: '2026-B5' },
    { preset: 'trimestral', date: '2026-10-14', key: '2026-T4' },
    { preset: 'semestral', date: '2026-10-14', key: '2026-S2' },
    { preset: 'anual', date: '2026-10-14', key: '2026' },
  ]

  it.each(presets)('$preset agrupa $date em $key', ({ preset, date, key }) => {
    expect(groupKeyFor(date, preset)).toBe(key)
  })

  it('separa registros em baldes distintos', () => {
    const rows: Registro[] = [
      row('a', '2026-01-10'),
      row('b', '2026-02-02'),
      row('c', '2026-07-01'),
    ]
    const anual = groupRegistros(rows, 'anual')
    expect(anual.size).toBe(1)
    const semestral = groupRegistros(rows, 'semestral')
    expect(semestral.get('2026-S1')?.length).toBe(2)
    expect(semestral.get('2026-S2')?.length).toBe(1)
    const bimestral = groupRegistros(rows, 'bimestral')
    expect(bimestral.get('2026-B1')?.length).toBe(2)
    expect(bimestral.get('2026-B4')?.length).toBe(1)
  })
})

describe('período anterior', () => {
  it('espelha a duração do intervalo atual', () => {
    expect(previousRange({ start: '2026-10-01', end: '2026-10-14' })).toEqual({
      start: '2026-09-17',
      end: '2026-09-30',
    })
  })
})

function row(id: string, data: string): Registro {
  return {
    id,
    data,
    kmInicial: 0,
    kmFinal: 10,
    ganhos: { uber: 1, noventaenove: 0, indrive: 0 },
    combustivel: 0,
    outrosGastos: 0,
    observacoes: '',
    atualizadoEm: data,
  }
}
