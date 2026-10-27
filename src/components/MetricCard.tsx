import { formatBRL, formatKm, formatPercent } from '../lib/format'

interface MetricCardProps {
  label: string
  value: number
  kind: 'money' | 'km' | 'percent'
  tone?: 'profit' | 'expense' | 'neutral'
  trend?: number | null
  hint?: string
}

export function MetricCard({ label, value, kind, tone = 'neutral', trend, hint }: MetricCardProps) {
  const formatted =
    kind === 'money' ? formatBRL(value) : kind === 'km' ? formatKm(value) : formatPercent(value)
  const toneClass =
    tone === 'profit'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'expense'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-900 dark:text-white'
  const hasTrend = trend !== undefined
  const trendLabel =
    trend === null
      ? 'sem base anterior'
      : trend === 0
        ? 'estável'
        : (trend ?? 0) > 0
          ? `alta de ${formatPercent(trend ?? 0)}`
          : `queda de ${formatPercent(Math.abs(trend ?? 0))}`
  const trendArrow = trend === null || trend === 0 ? '→' : (trend ?? 0) > 0 ? '↑' : '↓'
  const trendClass =
    trend === null || trend === 0
      ? 'text-slate-500'
      : (trend ?? 0) > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400'

  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      title={hint}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{formatted}</p>
      {hasTrend ? (
        <p className={`mt-2 text-xs font-medium ${trendClass}`} aria-label={`Tendência: ${trendLabel}`}>
          <span aria-hidden="true">{trendArrow}</span> {trendLabel}
        </p>
      ) : null}
    </article>
  )
}
