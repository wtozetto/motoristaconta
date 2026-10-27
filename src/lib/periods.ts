import type { PeriodPreset, Registro } from '../types'
import { todayISO } from './format'

export interface DateRange {
  start: string
  end: string
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(date: Date): string {
  return todayISO(date)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function diffDaysInclusive(start: string, end: string): number {
  const ms = parseISODate(end).getTime() - parseISODate(start).getTime()
  return Math.floor(ms / 86_400_000) + 1
}

export function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - weekday)
  return copy
}

export function getPeriodRange(
  preset: PeriodPreset,
  now: Date = new Date(),
  custom?: DateRange,
): DateRange {
  const end = toISODate(now)
  const y = now.getFullYear()
  const month = now.getMonth()

  switch (preset) {
    case 'diario':
      return { start: end, end }
    case 'semanal':
      return { start: toISODate(startOfWeekMonday(now)), end }
    case 'mensal':
      return { start: toISODate(new Date(y, month, 1)), end }
    case 'bimestral': {
      const startMonth = Math.floor(month / 2) * 2
      return { start: toISODate(new Date(y, startMonth, 1)), end }
    }
    case 'trimestral': {
      const startMonth = Math.floor(month / 3) * 3
      return { start: toISODate(new Date(y, startMonth, 1)), end }
    }
    case 'semestral': {
      const startMonth = month < 6 ? 0 : 6
      return { start: toISODate(new Date(y, startMonth, 1)), end }
    }
    case 'anual':
      return { start: toISODate(new Date(y, 0, 1)), end }
    case 'custom':
      return custom ?? { start: end, end }
  }
}

export function previousRange(range: DateRange): DateRange {
  const days = diffDaysInclusive(range.start, range.end)
  const prevEnd = addDays(range.start, -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  return { start: prevStart, end: prevEnd }
}

export function inRange(isoDate: string, range: DateRange): boolean {
  return isoDate >= range.start && isoDate <= range.end
}

export function filterByRange(registros: Registro[], range: DateRange): Registro[] {
  return registros.filter((r) => inRange(r.data, range))
}

export function groupKeyFor(isoDate: string, preset: PeriodPreset): string {
  const date = parseISODate(isoDate)
  const y = date.getFullYear()
  const month = date.getMonth()

  switch (preset) {
    case 'diario':
    case 'custom':
      return isoDate
    case 'semanal':
      return toISODate(startOfWeekMonday(date))
    case 'mensal':
      return `${y}-${String(month + 1).padStart(2, '0')}`
    case 'bimestral':
      return `${y}-B${Math.floor(month / 2) + 1}`
    case 'trimestral':
      return `${y}-T${Math.floor(month / 3) + 1}`
    case 'semestral':
      return `${y}-S${month < 6 ? 1 : 2}`
    case 'anual':
      return String(y)
  }
}

export function groupRegistros(
  registros: Registro[],
  preset: PeriodPreset,
): Map<string, Registro[]> {
  const map = new Map<string, Registro[]>()
  for (const registro of registros) {
    const key = groupKeyFor(registro.data, preset)
    const bucket = map.get(key)
    if (bucket) bucket.push(registro)
    else map.set(key, [registro])
  }
  return map
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  custom: 'Personalizado',
}

export const WEEKDAY_LABELS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const
