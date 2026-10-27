const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const NUMBER_2 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER_KM = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatBRL(value: number): string {
  return BRL.format(Number.isFinite(value) ? value : 0)
}

export function formatNumber2(value: number): string {
  return NUMBER_2.format(Number.isFinite(value) ? value : 0)
}

export function formatKm(value: number): string {
  return `${NUMBER_KM.format(Number.isFinite(value) ? value : 0)} km`
}

export function formatPercent(ratio: number): string {
  return PERCENT.format(Number.isFinite(ratio) ? ratio : 0)
}

export function formatDateISO(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
}

export function digitsToMoney(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

export function moneyToDigitsDisplay(value: number): string {
  return formatBRL(Math.max(0, value || 0))
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
