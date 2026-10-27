import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PlatformFilter, PeriodPreset, Registro } from '../types'
import { PLATFORM_LABEL } from '../types'
import { aggregateRegistros } from '../lib/calculations'
import { formatBRL } from '../lib/format'
import { groupRegistros } from '../lib/periods'

const COLORS = {
  uber: '#111111',
  noventaenove: '#2563eb',
  indrive: '#f97316',
  ganhos: '#059669',
  gastos: '#e11d48',
  lucro: '#0f766e',
}

interface DashboardChartsProps {
  registros: Registro[]
  filter: PlatformFilter
  grouping: PeriodPreset
}

export function DashboardCharts({ registros, filter, grouping }: DashboardChartsProps) {
  const agg = aggregateRegistros(registros, filter)
  const donut = [
    { name: PLATFORM_LABEL.uber, value: agg.ganhosPorPlataforma.uber, key: 'uber' },
    { name: PLATFORM_LABEL.noventaenove, value: agg.ganhosPorPlataforma.noventaenove, key: 'n99' },
    { name: PLATFORM_LABEL.indrive, value: agg.ganhosPorPlataforma.indrive, key: 'indrive' },
  ]
  const bars = donut

  const grouped = groupRegistros(registros, grouping === 'custom' ? 'diario' : grouping)
  const series = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const m = aggregateRegistros(rows, filter)
      return {
        name: key,
        lucro: m.lucroLiquido,
        ganhos: m.totalGanhos,
        gastos: m.totalGastos,
      }
    })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Participação por aplicativo">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
              <Cell fill={COLORS.uber} />
              <Cell fill={COLORS.noventaenove} />
              <Cell fill={COLORS.indrive} />
            </Pie>
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ganhos por aplicativo">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bars}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Bar dataKey="value" name="Ganhos">
              <Cell fill={COLORS.uber} />
              <Cell fill={COLORS.noventaenove} />
              <Cell fill={COLORS.indrive} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Lucro ao longo do tempo">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Line type="monotone" dataKey="lucro" stroke={COLORS.lucro} name="Lucro" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ganhos versus gastos">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Area type="monotone" dataKey="ganhos" stroke={COLORS.ganhos} fill="#05966933" name="Ganhos" />
            <Area type="monotone" dataKey="gastos" stroke={COLORS.gastos} fill="#e11d4833" name="Gastos" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}
