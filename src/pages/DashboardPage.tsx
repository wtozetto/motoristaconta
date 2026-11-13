import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../data/DataContext'
import { useTheme } from '../theme/ThemeContext'
import { MetricCard } from '../components/MetricCard'
import { PlatformFilterBar } from '../components/PlatformFilter'
import { RegistroTable } from '../components/RegistroTable'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MoneyInput } from '../components/MoneyInput'
import { DriveBadge } from '../components/DriveBadge'
import { aggregateRegistros, calculateGoalProjection, trendDelta } from '../lib/calculations'
import {
  filterByRange,
  getPeriodRange,
  PERIOD_LABELS,
  previousRange,
  parseISODate,
  type DateRange,
} from '../lib/periods'
import { buildTips } from '../lib/tips'
import { formatBRL, formatKm, formatPercent, formatDateISO, todayISO } from '../lib/format'
import { buildCombustivelAggregate, calculateCombustivelMetrics, getCombustiveisList, getCombustivelValor } from '../lib/fuel'
import { getAllManutencaoAlertas, getKmAtual } from '../lib/maintenance'
import { useReminders } from '../hooks/useReminders'
import { validateRegistro } from '../lib/validation'
import { exportarRelatorioPDF } from '../utils/pdfExport'
import { copiarResumoRelatorio } from '../utils/shareUtils'
import type {
  CombustivelTipo,
  PeriodPreset,
  PlatformFilter,
  Registro,
  RegistroInput,
} from '../types'
import { COMBUSTIVEL_LABEL } from '../types'

const DashboardCharts = lazy(() =>
  import('../components/DashboardCharts').then(({ DashboardCharts }) => ({
    default: DashboardCharts,
  })),
)
const CombustivelCharts = lazy(() =>
  import('../components/DashboardCharts').then(({ CombustivelCharts }) => ({
    default: CombustivelCharts,
  })),
)
const ManutencaoCharts = lazy(() =>
  import('../components/DashboardCharts').then(({ ManutencaoCharts }) => ({
    default: ManutencaoCharts,
  })),
)

function ChartsLoading() {
  return <p className="p-6 text-center text-sm text-slate-500">Carregando gráficos...</p>
}

const PRESETS: PeriodPreset[] = [
  'diario',
  'semanal',
  'mensal',
  'bimestral',
  'trimestral',
  'semestral',
  'anual',
]

export function DashboardPage() {
  const { registros, manutencoes, contasFixas, saveRegistro, removeRegistro } = useData()
  const { settings, updateSettings } = useTheme()
  const [preset, setPreset] = useState<PeriodPreset>('mensal')
  const [custom, setCustom] = useState<DateRange>({ start: todayISO(), end: todayISO() })
  const [filter, setFilter] = useState<PlatformFilter>('todas')
  const [editing, setEditing] = useState<Registro | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Registro | null>(null)
  const [includeMaintenance, setIncludeMaintenance] = useState(false)
  const [chartView, setChartView] = useState<'summary' | 'evolution' | 'comparison'>('summary')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const range = useMemo(
    () => getPeriodRange(preset, new Date(), custom),
    [preset, custom],
  )
  const currentRows = useMemo(() => filterByRange(registros, range), [registros, range])
  const prevRange = useMemo(() => previousRange(range), [range])
  const previousRows = useMemo(
    () => filterByRange(registros, prevRange),
    [registros, prevRange],
  )
  const current = aggregateRegistros(currentRows, filter)
  const previous = aggregateRegistros(previousRows, filter)
  const tips = buildTips(currentRows, settings, filter)
  const today = todayISO()
  const periodDate = useMemo(() => parseISODate(today), [today])
  const monthRange = useMemo(() => getPeriodRange('mensal', periodDate), [periodDate])
  const previousMonthRange = useMemo(() => previousRange(monthRange), [monthRange])
  const yearRange = useMemo(() => getPeriodRange('anual', periodDate), [periodDate])
  const todayMetrics = useMemo(
    () => aggregateRegistros(filterByRange(registros, { start: today, end: today })),
    [registros, today],
  )
  const monthRows = useMemo(() => filterByRange(registros, monthRange), [registros, monthRange])
  const yearRows = useMemo(() => filterByRange(registros, yearRange), [registros, yearRange])
  const monthMetrics = useMemo(() => aggregateRegistros(monthRows), [monthRows])
  const monthMetricsFiltered = useMemo(
    () => aggregateRegistros(monthRows, filter),
    [monthRows, filter],
  )
  const previousMonthRows = useMemo(
    () => filterByRange(registros, previousMonthRange),
    [registros, previousMonthRange],
  )
  const previousMonthMetrics = useMemo(
    () => aggregateRegistros(previousMonthRows, filter),
    [previousMonthRows, filter],
  )
  const yearMetrics = useMemo(() => aggregateRegistros(yearRows), [yearRows])
  const monthFuel = useMemo(
    () => monthRows.reduce((total, registro) => total + getCombustivelValor(registro.combustivel), 0),
    [monthRows],
  )
  const monthMaintenance = useMemo(
    () =>
      manutencoes
        .filter((item) => item.status === 'concluido' && item.data >= monthRange.start && item.data <= monthRange.end)
        .reduce((total, item) => total + item.valor, 0),
    [manutencoes, monthRange],
  )
  const previousMonthFuel = useMemo(
    () =>
      previousMonthRows.reduce(
        (total, registro) => total + getCombustivelValor(registro.combustivel),
        0,
      ),
    [previousMonthRows],
  )
  const previousMonthMaintenance = useMemo(
    () =>
      manutencoes
        .filter(
          (item) =>
            item.status === 'concluido' &&
            item.data >= previousMonthRange.start &&
            item.data <= previousMonthRange.end,
        )
        .reduce((total, item) => total + item.valor, 0),
    [manutencoes, previousMonthRange],
  )
  const yearMaintenance = useMemo(
    () =>
      manutencoes
        .filter((item) => item.status === 'concluido' && item.data >= yearRange.start && item.data <= yearRange.end)
        .reduce((total, item) => total + item.valor, 0),
    [manutencoes, yearRange],
  )
  const reminders = useReminders(contasFixas, manutencoes, settings.alertaManutencaoDias)
  const goalProgress = settings.metaMensal > 0 ? monthMetrics.totalGanhos / settings.metaMensal : 0
  const nowDate = periodDate
  const year = nowDate.getFullYear()
  const monthDays = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][nowDate.getMonth()]
  const daysRemaining = monthDays - nowDate.getDate() + 1
  const projection = calculateGoalProjection(
    monthMetrics.totalGanhos,
    settings.metaMensal,
    nowDate.getDate(),
    daysRemaining,
  )

  // Manutenção no período filtrado
  const currentManutencoes = useMemo(
    () => manutencoes.filter((m) => m.data >= range.start && m.data <= range.end),
    [manutencoes, range],
  )
  const previousManutencoes = useMemo(
    () => manutencoes.filter((m) => m.data >= prevRange.start && m.data <= prevRange.end),
    [manutencoes, prevRange],
  )
  const totalManutencao = useMemo(
    () => currentManutencoes.reduce((acc, m) => acc + m.valor, 0),
    [currentManutencoes],
  )
  const prevTotalManutencao = useMemo(
    () => previousManutencoes.reduce((acc, m) => acc + m.valor, 0),
    [previousManutencoes],
  )

  // Alertas de manutenção inteligente
  const kmAtual = useMemo(
    () => getKmAtual(registros, manutencoes),
    [registros, manutencoes],
  )
  const alertas = useMemo(
    () => getAllManutencaoAlertas(manutencoes, kmAtual, settings),
    [manutencoes, kmAtual, settings],
  )
  const urgentAlerts = useMemo(
    () => alertas.filter((a) => a.status === 'atrasado' || a.status === 'proximo'),
    [alertas],
  )

  // Combustível no período filtrado
  const fuelMetrics = useMemo(
    () => calculateCombustivelMetrics(currentRows, current.km),
    [currentRows, current.km],
  )

  // Valores considerando ou não a visão de custo real com manutenção
  const gastosExibidos = includeMaintenance
    ? current.totalGastos + totalManutencao
    : current.totalGastos
  const prevGastosExibidos = includeMaintenance
    ? previous.totalGastos + prevTotalManutencao
    : previous.totalGastos

  const lucroExibido = includeMaintenance
    ? current.totalGanhos - gastosExibidos
    : current.lucroLiquido
  const prevLucroExibido = includeMaintenance
    ? previous.totalGanhos - prevGastosExibidos
    : previous.lucroLiquido

  function exportReport(reportRange: DateRange, title: string) {
    const rows = filterByRange(registros, reportRange)
    const metrics = aggregateRegistros(rows, filter)
    const reportMaintenance = manutencoes.filter(
      (item) => item.status === 'concluido' && item.data >= reportRange.start && item.data <= reportRange.end,
    )
    const maintenanceTotal = reportMaintenance.reduce((total, item) => total + item.valor, 0)
    exportarRelatorioPDF({
      titulo: title,
      periodo: `${reportRange.start} a ${reportRange.end}`,
      resumo: {
        ganhos: metrics.totalGanhos,
        gastos: metrics.totalGastos,
        combustivel: rows.reduce((total, row) => total + getCombustivelValor(row.combustivel), 0),
        manutencao: maintenanceTotal,
        lucro: metrics.lucroLiquido - maintenanceTotal,
        km: metrics.km,
      },
      registros: rows.map((row) => ({
        data: row.data,
        ganhos: aggregateRegistros([row], filter).totalGanhos,
        gastos: getCombustivelValor(row.combustivel) + row.outrosGastos,
        km: row.kmFinal - row.kmInicial,
      })),
      manutencoes: reportMaintenance.map((item) => ({
        data: item.data,
        categoria: item.categoria,
        descricao: item.descricao,
        valor: item.valor,
      })),
    })
  }

  async function copyReport(reportRange: DateRange, title: string) {
    const rows = filterByRange(registros, reportRange)
    const metrics = aggregateRegistros(rows, filter)
    const maintenanceTotal = manutencoes
      .filter(
        (item) =>
          item.status === 'concluido' &&
          item.data >= reportRange.start &&
          item.data <= reportRange.end,
      )
      .reduce((total, item) => total + item.valor, 0)
    try {
      await copiarResumoRelatorio({
        periodo: title,
        ganhos: metrics.totalGanhos,
        gastos: metrics.totalGastos,
        manutencao: maintenanceTotal,
        lucro: metrics.lucroLiquido - maintenanceTotal,
        km: metrics.km,
      })
      setCopyFeedback('Resumo copiado.')
    } catch (error) {
      setCopyFeedback(error instanceof Error ? error.message : 'Não foi possível copiar o resumo.')
    }
    window.setTimeout(() => setCopyFeedback(null), 3000)
  }

  const outrosGastosTotal = Math.max(0, current.totalGastos - fuelMetrics.totalValor)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Período de {range.start} a {range.end}. Setas comparam com o intervalo anterior.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <DriveBadge />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportReport({ start: today, end: today }, 'Resumo do dia')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
            >
              Exportar resumo do dia em PDF
            </button>
            <button
              type="button"
              onClick={() => exportReport(monthRange, 'Relatório mensal')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
            >
              Exportar relatório mensal em PDF
            </button>
            <button
              type="button"
              onClick={() => void copyReport({ start: today, end: today }, 'Resumo do dia')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
            >
              Copiar resumo do dia
            </button>
            <button
              type="button"
              onClick={() => void copyReport(monthRange, 'Relatório mensal')}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
            >
              Copiar resumo mensal
            </button>
          </div>
          {copyFeedback ? <p role="status" className="text-xs text-slate-500">{copyFeedback}</p> : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold sm:text-sm dark:border-slate-800 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={includeMaintenance}
              onChange={(e) => setIncludeMaintenance(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-600"
            />
            <span>Custo total real (inclui manutenção)</span>
          </label>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="card overflow-hidden">
          <h2 className="card-header px-4 py-2 font-semibold">Hoje</h2>
          <div className="p-4">
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-xs text-slate-500">Ganhos</p><p className="text-dourado text-lg font-bold">{formatBRL(todayMetrics.totalGanhos)}</p></div>
            <div><p className="text-xs text-slate-500">Km percorridos</p><p className="text-lg font-bold">{formatKm(todayMetrics.km)}</p></div>
          </div>
          </div>
        </article>

        <article className="card overflow-hidden">
          <h2 className="card-header px-4 py-2 font-semibold">Este mês</h2>
          <div className="p-4">
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div><p className="text-xs text-slate-500">Ganhos</p><p className="text-dourado font-bold">{formatBRL(monthMetrics.totalGanhos)}</p></div>
            <div><p className="text-xs text-slate-500">Combustível</p><p className="text-gastos-escuro font-bold">{formatBRL(monthFuel)}</p></div>
            <div><p className="text-xs text-slate-500">Manutenção</p><p className="text-gastos-escuro font-bold">{formatBRL(monthMaintenance)}</p></div>
            <div><p className="text-xs text-slate-500">Km total</p><p className="font-bold">{formatKm(monthMetrics.km)}</p></div>
            <div className="col-span-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <p className="text-xs text-slate-500">Lucro (inclui todos os gastos)</p>
              <p className={`font-bold ${monthMetrics.totalGanhos - monthMetrics.totalGastos - monthMaintenance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatBRL(monthMetrics.totalGanhos - monthMetrics.totalGastos - monthMaintenance)}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <label className="block text-xs font-semibold">
              Quanto pretendo ganhar este mês?
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.metaMensal}
                onChange={(event) => {
                  const amount = Number(event.target.value)
                  updateSettings({ metaMensal: Number.isFinite(amount) ? Math.max(0, amount) : 0 })
                }}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {settings.metaMensal > 0 ? (
              <>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="progressbar"
                  aria-label="Progresso da meta mensal"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.round(goalProgress * 100))}
                >
                  <div className="progress-bar h-full" style={{ width: `${Math.min(100, Math.max(0, goalProgress * 100))}%` }} />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-xs text-slate-500">
                  <span>{formatPercent(goalProgress)} concluído · faltam {formatBRL(projection.remaining)}</span>
                  <span>{projection.remaining === 0 ? 'Meta atingida' : `${formatBRL(projection.dailyRequired)}/dia necessário`}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {projection.daysToGoal === 0
                    ? 'Meta atingida.'
                    : projection.daysToGoal === null
                      ? 'Registre ganhos para estimar quando a meta será atingida.'
                      : `Mantendo a média atual, a meta será atingida em aproximadamente ${projection.daysToGoal} ${projection.daysToGoal === 1 ? 'dia' : 'dias'}.`}
                </p>
              </>
            ) : null}
          </div>
          </div>
        </article>

        <article className="card overflow-hidden">
          <h2 className="card-header px-4 py-2 font-semibold">Este ano</h2>
          <div className="p-4">
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-xs text-slate-500">Ganhos totais</p><p className="text-dourado text-lg font-bold">{formatBRL(yearMetrics.totalGanhos)}</p></div>
            <div><p className="text-xs text-slate-500">Gastos totais</p><p className="text-gastos-escuro text-lg font-bold">{formatBRL(yearMetrics.totalGastos + yearMaintenance)}</p></div>
            <div className="col-span-2"><p className="text-xs text-slate-500">Km total</p><p className="text-lg font-bold">{formatKm(yearMetrics.km)}</p></div>
          </div>
          </div>
        </article>
      </section>

      {/* Alerta inteligente de manutenção no topo */}
      {urgentAlerts.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700/50 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Atenção: {urgentAlerts.length} manutenção(ões) veicular(es) requer(em) atenção!
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {urgentAlerts[0].manutencao.categoria}: {urgentAlerts[0].detalhe}
                {urgentAlerts.length > 1
                  ? ` (e mais ${urgentAlerts.length - 1} item(ns))`
                  : ''}
              </p>
            </div>
          </div>
          <Link
            to="/manutencao"
            className="self-start whitespace-nowrap rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 sm:self-auto"
          >
            Ver manutenções
          </Link>
        </div>
      ) : null}

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
        {PRESETS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPreset(item)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              preset === item
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {PERIOD_LABELS[item]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreset('custom')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            preset === 'custom'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          Personalizado
        </button>
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            De
            <input
              type="date"
              className="ml-2 h-10 rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-900"
              value={custom.start}
              onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            Até
            <input
              type="date"
              className="ml-2 h-10 rounded-lg border border-slate-200 px-2 dark:border-slate-700 dark:bg-slate-900"
              value={custom.end}
              onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <PlatformFilterBar value={filter} onChange={setFilter} />

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricCard
          label="Ganhos"
          value={current.totalGanhos}
          kind="money"
          tone="profit"
          trend={trendDelta(current.totalGanhos, previous.totalGanhos)}
        />
        <MetricCard
          label={includeMaintenance ? 'Gastos (c/ manut.)' : 'Gastos'}
          value={gastosExibidos}
          kind="money"
          tone="expense"
          trend={trendDelta(gastosExibidos, prevGastosExibidos)}
        />
        <MetricCard
          label={includeMaintenance ? 'Lucro Real' : 'Lucro'}
          value={lucroExibido}
          kind="money"
          tone={lucroExibido >= 0 ? 'profit' : 'negative'}
          trend={trendDelta(lucroExibido, prevLucroExibido)}
        />
        <MetricCard
          label="Km"
          value={current.km}
          kind="km"
          trend={trendDelta(current.km, previous.km)}
        />
        <MetricCard
          label="Média/km"
          value={current.mediaGanhoPorKm}
          kind="money"
          trend={trendDelta(current.mediaGanhoPorKm, previous.mediaGanhoPorKm)}
          hint="Ganhos considerados / km do dia. Com filtro de app, ganhos são só daquele app; km segue o odômetro do dia."
        />
        <MetricCard
          label="Manutenção"
          value={totalManutencao}
          kind="money"
          tone="expense"
          trend={trendDelta(totalManutencao, prevTotalManutencao)}
          hint="Gastos com serviços e peças de manutenção realizadas no período selecionado."
        />
      </div>

      {/* Composição Detalhada dos Gastos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Composição detalhada dos gastos no período
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="card-hover-gastos rounded-xl border borda-gastos bg-gastos-suave p-3">
            <span className="text-xs text-slate-500">Combustível total</span>
            <p className="text-lg font-bold text-gastos-escuro tabular-nums">
              {formatBRL(fuelMetrics.totalValor)}
            </p>
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
              {fuelMetrics.porTipo.etanol.valor > 0 ? (
                <div className="text-gastos-escuro">Etanol: {formatBRL(fuelMetrics.porTipo.etanol.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.gasolina.valor > 0 ? (
                <div className="text-gastos-escuro">Gasolina: {formatBRL(fuelMetrics.porTipo.gasolina.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.diesel.valor > 0 ? (
                <div className="text-gastos-escuro">Diesel: {formatBRL(fuelMetrics.porTipo.diesel.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.nao_informado.valor > 0 ? (
                <div className="text-gastos-escuro">Não informado: {formatBRL(fuelMetrics.porTipo.nao_informado.valor)}</div>
              ) : null}
            </div>
          </div>

          <div className="card-hover-gastos rounded-xl border borda-gastos bg-gastos-suave p-3">
            <span className="text-xs text-slate-500">Outros gastos operacionais</span>
            <p className="text-lg font-bold text-gastos-escuro tabular-nums">
              {formatBRL(outrosGastosTotal)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Pedágios, lavagem, alimentação e despesas diárias
            </p>
          </div>

          <div className="card-hover-gastos rounded-xl border borda-gastos bg-gastos-suave p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Manutenção veicular</span>
              <Link to="/manutencao" className="text-[11px] font-semibold text-emerald-600 hover:underline">
                Gerenciar
              </Link>
            </div>
            <p className="text-lg font-bold text-gastos-escuro tabular-nums">
              {formatBRL(totalManutencao)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {currentManutencoes.length} serviço(s) realizado(s) no período
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO 1: COMBUSTÍVEL */}
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold">Combustível no período</h2>
            <p className="text-xs text-slate-500">
              Análise de consumo por tipo, preços médios e eficiência por km rodado.
            </p>
          </div>
          <span className="badge-gastos rounded-full px-3 py-1 text-xs font-semibold">
            Custo Combustível: {formatBRL(fuelMetrics.custoPorKm)}/km
          </span>
        </div>

        {/* Resumo de métricas por tipo */}
        <div className="grid gap-3 sm:grid-cols-3">
          {(['etanol', 'gasolina', 'diesel'] as CombustivelTipo[]).map((tipo) => {
            const data = fuelMetrics.porTipo[tipo]
            return (
              <div
                key={tipo}
                className="card-hover-gastos rounded-2xl border borda-gastos bg-gastos-suave p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{COMBUSTIVEL_LABEL[tipo]}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {data.litros > 0 ? `${data.litros.toFixed(1)} L` : '—'}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-gastos-escuro tabular-nums">
                  {formatBRL(data.valor)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Preço médio</span>
                    <span className="font-semibold tabular-nums text-gastos-escuro">
                      {data.precoMedio > 0 ? `${formatBRL(data.precoMedio)}/L` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Autonomia</span>
                    <span className="font-semibold tabular-nums">
                      {data.kmPorLitro !== null ? `${data.kmPorLitro.toFixed(1)} km/L` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Gráficos de combustível */}
        <Suspense fallback={<ChartsLoading />}>
          <CombustivelCharts registros={currentRows} grouping={preset} />
        </Suspense>
      </section>

      {/* SEÇÃO 2: MANUTENÇÃO VEICULAR */}
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold">Manutenção veicular no período</h2>
            <p className="text-xs text-slate-500">
              Controle preventivo e corretivo. KM atual do veículo:{' '}
              <strong>{formatKm(kmAtual)}</strong>.
            </p>
          </div>
          <Link
            to="/manutencao"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Abrir módulo de manutenção →
          </Link>
        </div>

        {currentManutencoes.length > 0 ? (
          <Suspense fallback={<ChartsLoading />}>
            <ManutencaoCharts manutencoes={currentManutencoes} />
          </Suspense>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhuma manutenção registrada no período de {range.start} a {range.end}.
          </p>
        )}
      </section>

      {/* Dicas inteligentes */}
      <section aria-label="Dicas">
        <h2 className="mb-2 text-base font-semibold">Dicas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {tips.map((tip) => (
            <article
              key={tip.id}
              className={`rounded-2xl border p-4 text-sm ${
                tip.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                  : tip.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <h3 className="font-semibold">{tip.title}</h3>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{tip.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Gráficos de Plataformas e Resultados */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Gráficos</h2>
          <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Visualização dos gráficos">
            {([
              ['summary', 'Resumo'],
              ['evolution', 'Evolução'],
              ['comparison', 'Comparativo'],
            ] as const).map(([view, label]) => (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={chartView === view}
                onClick={() => setChartView(view)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  chartView === view
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Suspense fallback={<ChartsLoading />}>
          <DashboardCharts
            registros={chartView === 'evolution' ? registros : currentRows}
            filter={filter}
            grouping={preset}
            view={chartView}
            monthlyComparison={{
              current: {
                ganhos: monthMetricsFiltered.totalGanhos,
                combustivel: monthFuel,
                manutencao: monthMaintenance,
                lucro:
                  monthMetricsFiltered.totalGanhos -
                  monthMetricsFiltered.totalGastos -
                  monthMaintenance,
              },
              previous: {
                ganhos: previousMonthMetrics.totalGanhos,
                combustivel: previousMonthFuel,
                manutencao: previousMonthMaintenance,
                lucro:
                  previousMonthMetrics.totalGanhos -
                  previousMonthMetrics.totalGastos -
                  previousMonthMaintenance,
              },
            }}
          />
        </Suspense>
      </section>

      {editing ? (
        <p className="text-sm text-slate-500">
          Edição pela tabela abaixo redireciona ao formulário em Lançamentos se preferir mais campos.
          Você também pode editar aqui:
        </p>
      ) : null}

      <RegistroTable
        registros={[...currentRows].sort((a, b) => b.data.localeCompare(a.data))}
        filter={filter}
        onEdit={setEditing}
        onDelete={setPendingDelete}
      />

      {editing ? (
        <QuickEdit
          registro={editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await saveRegistro(input, editing.id)
            setEditing(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir lançamento?"
        confirmLabel="Excluir"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeRegistro(pendingDelete.id)
          setPendingDelete(null)
        }}
      >
        O lançamento será removido deste navegador.
      </ConfirmDialog>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Próximos vencimentos</h2>
            <p className="text-xs text-slate-500">Contas e manutenções para os próximos {settings.alertaManutencaoDias} dias.</p>
          </div>
          <Link to="/lembretes" className="text-sm font-semibold text-emerald-600 hover:underline">
            Gerenciar
          </Link>
        </div>
        {reminders.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Nenhum vencimento próximo.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {reminders.map((reminder) => (
              <li
                key={`${reminder.tipo}-${reminder.id}`}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                  reminder.status === 'vencido'
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                    : reminder.status === 'vence_hoje'
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
                      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{reminder.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateISO(reminder.dataVencimento)}
                    {reminder.valor !== undefined ? (
                      <> · <span className="font-semibold text-gastos-escuro">{formatBRL(reminder.valor)}</span></>
                    ) : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold">{reminder.mensagem}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function QuickEdit({
  registro,
  onClose,
  onSave,
}: {
  registro: Registro
  onClose: () => void
  onSave: (input: RegistroInput) => Promise<void>
}) {
  const [data, setData] = useState(registro.data)
  const [kmInicial, setKmInicial] = useState(registro.kmInicial)
  const [kmFinal, setKmFinal] = useState(registro.kmFinal)
  const [uber, setUber] = useState(registro.ganhos.uber)
  const [n99, setN99] = useState(registro.ganhos.noventaenove)
  const [indrive, setIndrive] = useState(registro.ganhos.indrive)

  const initialList = getCombustiveisList(registro)
  const primaryFuel = initialList[0] ?? { tipo: 'gasolina', valor: 0, litros: undefined }

  const [fuelTipo, setFuelTipo] = useState<CombustivelTipo>(
    primaryFuel.tipo === 'nao_informado' ? 'gasolina' : primaryFuel.tipo,
  )
  const [combustivelValor, setCombustivelValor] = useState(primaryFuel.valor)
  const [combustivelLitros, setCombustivelLitros] = useState<number | undefined>(
    primaryFuel.litros,
  )
  const [outros, setOutros] = useState(registro.outrosGastos ?? 0)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={async (e) => {
        e.preventDefault()
        // Preserva os demais abastecimentos do lançamento; apenas o primeiro
        // item é editado aqui. O agregado é recalculado a partir da lista.
        const baseList = getCombustiveisList(registro)
        const mergedList = baseList.map((item, index) =>
          index === 0
            ? { tipo: fuelTipo, valor: combustivelValor, litros: combustivelLitros }
            : item,
        )
        const agg = buildCombustivelAggregate(mergedList)
        const payload: RegistroInput = {
          data,
          kmInicial,
          kmFinal,
          ganhos: { uber, noventaenove: n99, indrive },
          combustivel: agg.combustivel,
          combustiveis: agg.combustiveis,
          outrosGastos: outros,
          observacoes: registro.observacoes,
        }
        const nextErrors = validateRegistro(payload)
        setErrors(nextErrors)
        if (nextErrors.length > 0) return
        setSaving(true)
        try {
          await onSave(payload)
        } catch (err) {
          setErrors([err instanceof Error ? err.message : 'Não foi possível salvar.'])
        } finally {
          setSaving(false)
        }
      }}
    >
      <h2 className="font-semibold">Editar lançamento de {registro.data}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Data
          <input
            type="date"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="text-sm">
          KM inicial
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={kmInicial}
            onChange={(e) => setKmInicial(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          KM final
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={kmFinal}
            onChange={(e) => setKmFinal(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyInput id="quick-uber" label="Uber" value={uber} onChange={setUber} />
        <MoneyInput id="quick-99" label="99" value={n99} onChange={setN99} />
        <MoneyInput id="quick-indrive" label="Indrive" value={indrive} onChange={setIndrive} />
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
        <span className="text-xs font-semibold text-slate-500">Combustível</span>
        <div className="grid grid-cols-3 gap-2">
          {(['etanol', 'gasolina', 'diesel'] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFuelTipo(tipo)}
              className={`h-9 rounded-lg text-xs font-semibold ${
                fuelTipo === tipo
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border dark:bg-slate-800 dark:border-slate-700'
              }`}
            >
              {COMBUSTIVEL_LABEL[tipo]}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput
            id="quick-combustivel"
            label="Valor R$"
            value={combustivelValor}
            onChange={setCombustivelValor}
          />
          <label className="text-sm">
            Litros (opcional)
            <input
              type="number"
              step="0.01"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              value={combustivelLitros ?? ''}
              onChange={(e) =>
                setCombustivelLitros(e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        <MoneyInput
          id="quick-outros"
          label="Outros gastos"
          value={outros}
          onChange={setOutros}
        />
      </div>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-600" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          className="h-10 rounded-xl px-4 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
