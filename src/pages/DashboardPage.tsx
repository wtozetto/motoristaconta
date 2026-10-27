import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { useTheme } from '../theme/ThemeContext'
import { DashboardCharts } from '../components/DashboardCharts'
import { MetricCard } from '../components/MetricCard'
import { PlatformFilterBar } from '../components/PlatformFilter'
import { RegistroTable } from '../components/RegistroTable'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { aggregateRegistros, trendDelta } from '../lib/calculations'
import {
  filterByRange,
  getPeriodRange,
  PERIOD_LABELS,
  previousRange,
  type DateRange,
} from '../lib/periods'
import { buildTips } from '../lib/tips'
import { todayISO } from '../lib/format'
import type { PeriodPreset, PlatformFilter, Registro } from '../types'

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
  const previousRows = useMemo(
    () => filterByRange(registros, previousRange(range)),
    [registros, range],
  )
  const current = aggregateRegistros(currentRows, filter)
  const previous = aggregateRegistros(previousRows, filter)
  const tips = buildTips(currentRows, settings, filter)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Período {range.start} a {range.end}. Setas comparam com o intervalo anterior de mesmo
          tamanho.
        </p>
      </header>

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

      <DashboardCharts registros={currentRows} filter={filter} grouping={preset} />

      {editing ? (
        <p className="text-sm text-slate-500">
          Edição pela tabela abaixo redireciona ao formulário em Lançamentos se preferir mais
          campos. Você também pode editar aqui:
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
  onSave: (input: {
    data: string
    kmInicial: number
    kmFinal: number
    ganhos: Registro['ganhos']
    combustivel: number
    outrosGastos: number
    observacoes: string
  }) => Promise<void>
}) {
  const [data, setData] = useState(registro.data)
  const [kmInicial, setKmInicial] = useState(registro.kmInicial)
  const [kmFinal, setKmFinal] = useState(registro.kmFinal)
  const [uber, setUber] = useState(registro.ganhos.uber)
  const [n99, setN99] = useState(registro.ganhos.noventaenove)
  const [indrive, setIndrive] = useState(registro.ganhos.indrive)
  const [combustivel, setCombustivel] = useState(registro.combustivel)
  const [outros, setOutros] = useState(registro.outrosGastos ?? 0)

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={async (e) => {
        e.preventDefault()
        await onSave({
          data,
          kmInicial,
          kmFinal,
          ganhos: { uber, noventaenove: n99, indrive },
          combustivel,
          outrosGastos: outros,
          observacoes: registro.observacoes,
        })
      }}
    >
      <h2 className="font-semibold">Editar {registro.data}</h2>
      <div className="grid gap-3 sm:grid-cols-4">
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
        <label className="text-sm">
          Combustível
          <input
            type="number"
            step="0.01"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={combustivel}
            onChange={(e) => setCombustivel(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Outros gastos
          <input
            type="number"
            step="0.01"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={outros}
            onChange={(e) => setOutros(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Uber
          <input
            type="number"
            step="0.01"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={uber}
            onChange={(e) => setUber(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          99
          <input
            type="number"
            step="0.01"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={n99}
            onChange={(e) => setN99(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          Indrive
          <input
            type="number"
            step="0.01"
            className="mt-1 h-10 w-full rounded-lg border px-2 dark:border-slate-700 dark:bg-slate-900"
            value={indrive}
            onChange={(e) => setIndrive(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">
          Salvar
        </button>
        <button type="button" className="h-10 rounded-xl px-4 text-sm" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
