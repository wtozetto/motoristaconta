import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { useTheme } from '../theme/ThemeContext'
import { CombustivelCharts, DashboardCharts } from '../components/DashboardCharts'
import { MetricCard } from '../components/MetricCard'
import { PlatformFilterBar } from '../components/PlatformFilter'
import { RegistroTable } from '../components/RegistroTable'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MoneyInput } from '../components/MoneyInput'
import { aggregateRegistros, trendDelta } from '../lib/calculations'
import {
  filterByRange,
  getPeriodRange,
  PERIOD_LABELS,
  previousRange,
  type DateRange,
} from '../lib/periods'
import { buildTips } from '../lib/tips'
import { formatBRL, todayISO } from '../lib/format'
import { calculateCombustivelMetrics, getCombustiveisList } from '../lib/fuel'
import type {
  CombustivelTipo,
  PeriodPreset,
  PlatformFilter,
  Registro,
  RegistroInput,
} from '../types'
import { COMBUSTIVEL_LABEL } from '../types'

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
  const { registros, saveRegistro, removeRegistro } = useData()
  const { settings } = useTheme()
  const [preset, setPreset] = useState<PeriodPreset>('mensal')
  const [custom, setCustom] = useState<DateRange>({ start: todayISO(), end: todayISO() })
  const [filter, setFilter] = useState<PlatformFilter>('todas')
  const [editing, setEditing] = useState<Registro | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Registro | null>(null)

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

  // Combustível no período filtrado
  const fuelMetrics = useMemo(
    () => calculateCombustivelMetrics(currentRows, current.km),
    [currentRows, current.km],
  )

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
      </header>

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Ganhos"
          value={current.totalGanhos}
          kind="money"
          tone="profit"
          trend={trendDelta(current.totalGanhos, previous.totalGanhos)}
        />
        <MetricCard
          label="Gastos"
          value={current.totalGastos}
          kind="money"
          tone="expense"
          trend={trendDelta(current.totalGastos, previous.totalGastos)}
        />
        <MetricCard
          label="Lucro"
          value={current.lucroLiquido}
          kind="money"
          tone={current.lucroLiquido >= 0 ? 'profit' : 'expense'}
          trend={trendDelta(current.lucroLiquido, previous.lucroLiquido)}
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
      </div>

      {/* Composição Detalhada dos Gastos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Composição detalhada dos gastos no período
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <span className="text-xs text-slate-500">Combustível total</span>
            <p className="text-lg font-bold text-rose-600 tabular-nums">
              {formatBRL(fuelMetrics.totalValor)}
            </p>
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
              {fuelMetrics.porTipo.etanol.valor > 0 ? (
                <div>Etanol: {formatBRL(fuelMetrics.porTipo.etanol.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.gasolina.valor > 0 ? (
                <div>Gasolina: {formatBRL(fuelMetrics.porTipo.gasolina.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.diesel.valor > 0 ? (
                <div>Diesel: {formatBRL(fuelMetrics.porTipo.diesel.valor)}</div>
              ) : null}
              {fuelMetrics.porTipo.nao_informado.valor > 0 ? (
                <div>Não informado: {formatBRL(fuelMetrics.porTipo.nao_informado.valor)}</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <span className="text-xs text-slate-500">Outros gastos operacionais</span>
            <p className="text-lg font-bold text-slate-700 tabular-nums dark:text-slate-200">
              {formatBRL(outrosGastosTotal)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Pedágios, lavagem, alimentação e despesas diárias
            </p>
          </div>
        </div>
      </section>

      {/* SEÇÃO COMBUSTÍVEL */}
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold">Combustível no período</h2>
            <p className="text-xs text-slate-500">
              Análise de consumo por tipo, preços médios e eficiência por km rodado.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{COMBUSTIVEL_LABEL[tipo]}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {data.litros > 0 ? `${data.litros.toFixed(1)} L` : '—'}
                  </span>
                </div>
                <div className="mt-2 text-xl font-bold text-slate-900 tabular-nums dark:text-white">
                  {formatBRL(data.valor)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Preço médio</span>
                    <span className="font-semibold tabular-nums">
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
        <CombustivelCharts registros={currentRows} grouping={preset} />
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
      <DashboardCharts registros={currentRows} filter={filter} grouping={preset} />

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

  return (
    <form
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={async (e) => {
        e.preventDefault()
        await onSave({
          data,
          kmInicial,
          kmFinal,
          ganhos: { uber, noventaenove: n99, indrive },
          combustivel: {
            tipo: fuelTipo,
            valor: combustivelValor,
            litros: combustivelLitros,
          },
          combustiveis: [
            {
              tipo: fuelTipo,
              valor: combustivelValor,
              litros: combustivelLitros,
            },
          ],
          outrosGastos: outros,
          observacoes: registro.observacoes,
        })
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

      <div className="flex gap-2">
        <button
          type="submit"
          className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Salvar
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
