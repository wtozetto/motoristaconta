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
import type { Manutencao, PeriodPreset, PlatformFilter, Registro } from '../types'
import { COMBUSTIVEL_COLORS, COMBUSTIVEL_LABEL, PLATFORM_LABEL } from '../types'
import { aggregateRegistros } from '../lib/calculations'
import { formatBRL } from '../lib/format'
import { getCombustiveisList } from '../lib/fuel'
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
  // Com filtro de app ativo, os gráficos de participação mostram apenas o
  // aplicativo selecionado (alinhado aos cartões e à tabela).
  const plataformasFiltradas = {
    uber: filter === 'todas' || filter === 'uber' ? agg.ganhosPorPlataforma.uber : 0,
    noventaenove:
      filter === 'todas' || filter === 'noventaenove' ? agg.ganhosPorPlataforma.noventaenove : 0,
    indrive: filter === 'todas' || filter === 'indrive' ? agg.ganhosPorPlataforma.indrive : 0,
  }
  const donut = [
    { name: PLATFORM_LABEL.uber, value: plataformasFiltradas.uber, key: 'uber' },
    { name: PLATFORM_LABEL.noventaenove, value: plataformasFiltradas.noventaenove, key: 'n99' },
    { name: PLATFORM_LABEL.indrive, value: plataformasFiltradas.indrive, key: 'indrive' },
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
            <Area
              type="monotone"
              dataKey="ganhos"
              stroke={COLORS.ganhos}
              fill="#05966933"
              name="Ganhos"
            />
            <Area
              type="monotone"
              dataKey="gastos"
              stroke={COLORS.gastos}
              fill="#e11d4833"
              name="Gastos"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

interface CombustivelChartsProps {
  registros: Registro[]
  grouping: PeriodPreset
}

export function CombustivelCharts({ registros, grouping }: CombustivelChartsProps) {
  // Totais por tipo de combustível para gráfico de rosca
  const totals = { etanol: 0, gasolina: 0, diesel: 0, nao_informado: 0 }
  for (const reg of registros) {
    const list = getCombustiveisList(reg)
    for (const item of list) {
      const t = item.tipo in totals ? item.tipo : 'nao_informado'
      totals[t] += item.valor
    }
  }

  const pieData = [
    { name: COMBUSTIVEL_LABEL.etanol, value: totals.etanol, color: COMBUSTIVEL_COLORS.etanol },
    {
      name: COMBUSTIVEL_LABEL.gasolina,
      value: totals.gasolina,
      color: COMBUSTIVEL_COLORS.gasolina,
    },
    { name: COMBUSTIVEL_LABEL.diesel, value: totals.diesel, color: COMBUSTIVEL_COLORS.diesel },
    ...(totals.nao_informado > 0
      ? [
          {
            name: COMBUSTIVEL_LABEL.nao_informado,
            value: totals.nao_informado,
            color: COMBUSTIVEL_COLORS.nao_informado,
          },
        ]
      : []),
  ].filter((d) => d.value > 0)

  // Gráfico empilhado ao longo do tempo
  const grouped = groupRegistros(registros, grouping === 'custom' ? 'diario' : grouping)
  const stackedSeries = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const sub = { etanol: 0, gasolina: 0, diesel: 0, nao_informado: 0 }
      for (const r of rows) {
        const list = getCombustiveisList(r)
        for (const item of list) {
          const t = item.tipo in sub ? item.tipo : 'nao_informado'
          sub[t] += item.valor
        }
      }
      return {
        name: key,
        etanol: sub.etanol,
        gasolina: sub.gasolina,
        diesel: sub.diesel,
        nao_informado: sub.nao_informado,
      }
    })

  const hasAnyFuel = totals.etanol + totals.gasolina + totals.diesel + totals.nao_informado > 0

  if (!hasAnyFuel) {
    return null
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Distribuição por tipo de combustível">
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-56 items-center justify-center text-sm text-slate-500">
            Nenhum abastecimento no período.
          </div>
        )}
      </ChartCard>

      <ChartCard title="Gasto com combustível por tipo ao longo do tempo">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stackedSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Legend />
            <Bar
              dataKey="etanol"
              name="Etanol"
              stackId="combustivel"
              fill={COMBUSTIVEL_COLORS.etanol}
            />
            <Bar
              dataKey="gasolina"
              name="Gasolina"
              stackId="combustivel"
              fill={COMBUSTIVEL_COLORS.gasolina}
            />
            <Bar
              dataKey="diesel"
              name="Diesel"
              stackId="combustivel"
              fill={COMBUSTIVEL_COLORS.diesel}
            />
            {totals.nao_informado > 0 ? (
              <Bar
                dataKey="nao_informado"
                name="Não informado"
                stackId="combustivel"
                fill={COMBUSTIVEL_COLORS.nao_informado}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

interface ManutencaoChartsProps {
  manutencoes: Manutencao[]
}

export function ManutencaoCharts({ manutencoes }: ManutencaoChartsProps) {
  if (manutencoes.length === 0) return null

  const categoryMap: Record<string, number> = {}
  for (const m of manutencoes) {
    categoryMap[m.categoria] = (categoryMap[m.categoria] ?? 0) + m.valor
  }

  const categoryData = Object.entries(categoryMap)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor)

  // Gastos ao longo do tempo ordenados
  const dateMap: Record<string, number> = {}
  for (const m of manutencoes) {
    const key = m.data.slice(0, 7) // YYYY-MM
    dateMap[key] = (dateMap[key] ?? 0) + m.valor
  }
  const timeData = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ mes, valor }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Gastos com manutenção por categoria">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis type="number" tickFormatter={(v) => `R$ ${v}`} />
            <YAxis dataKey="categoria" type="category" width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Bar dataKey="valor" name="Valor total" fill="#0d9488" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gastos com manutenção ao longo do tempo (Mês)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={timeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={(v) => formatBRL(Number(v))} />
            <Bar dataKey="valor" name="Manutenção" fill="#0284c7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}
