import { useEffect, useMemo, useState } from 'react'
import type { Registro, RegistroInput } from '../types'
import { deriveRegistro } from '../lib/calculations'
import { formatBRL, formatKm, todayISO } from '../lib/format'
import { validateRegistro } from '../lib/validation'
import { MoneyInput } from './MoneyInput'

const emptyInput = (): RegistroInput => ({
  data: todayISO(),
  kmInicial: 0,
  kmFinal: 0,
  ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
  combustivel: 0,
  outrosGastos: 0,
  observacoes: '',
})

interface RegistroFormProps {
  editing?: Registro | null
  onCancelEdit?: () => void
  onSubmit: (input: RegistroInput, id?: string) => Promise<void>
}

export function RegistroForm({ editing, onCancelEdit, onSubmit }: RegistroFormProps) {
  const [form, setForm] = useState<RegistroInput>(emptyInput)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setForm(emptyInput())
      return
    }
    setForm({
      data: editing.data,
      kmInicial: editing.kmInicial,
      kmFinal: editing.kmFinal,
      ganhos: { ...editing.ganhos },
      combustivel: editing.combustivel,
      outrosGastos: editing.outrosGastos ?? 0,
      observacoes: editing.observacoes,
    })
  }, [editing])

  const live = useMemo(
    () =>
      deriveRegistro({
        id: 'preview',
        atualizadoEm: '',
        observacoes: form.observacoes ?? '',
        data: form.data,
        kmInicial: form.kmInicial,
        kmFinal: form.kmFinal,
        ganhos: form.ganhos,
        combustivel: form.combustivel,
        outrosGastos: form.outrosGastos ?? 0,
      }),
    [form],
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateRegistro(form)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return
    setSaving(true)
    try {
      await onSubmit(form, editing?.id)
      if (!editing) setForm(emptyInput())
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Não foi possível salvar.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        {editing ? (
          <button type="button" className="text-sm text-slate-500 underline" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="data" className="text-sm font-medium">
            Data
          </label>
          <input
            id="data"
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="kmInicial" className="text-sm font-medium">
            KM inicial
          </label>
          <input
            id="kmInicial"
            type="number"
            min={0}
            step={1}
            value={form.kmInicial}
            onChange={(e) => setForm((f) => ({ ...f, kmInicial: Number(e.target.value) }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="kmFinal" className="text-sm font-medium">
            KM final
          </label>
          <input
            id="kmFinal"
            type="number"
            min={0}
            step={1}
            value={form.kmFinal}
            onChange={(e) => setForm((f) => ({ ...f, kmFinal: Number(e.target.value) }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MoneyInput
          id="uber"
          label="Ganhos Uber"
          value={form.ganhos.uber}
          onChange={(uber) => setForm((f) => ({ ...f, ganhos: { ...f.ganhos, uber } }))}
        />
        <MoneyInput
          id="n99"
          label="Ganhos 99"
          value={form.ganhos.noventaenove}
          onChange={(noventaenove) =>
            setForm((f) => ({ ...f, ganhos: { ...f.ganhos, noventaenove } }))
          }
        />
        <MoneyInput
          id="indrive"
          label="Ganhos Indrive"
          value={form.ganhos.indrive}
          onChange={(indrive) => setForm((f) => ({ ...f, ganhos: { ...f.ganhos, indrive } }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput
          id="combustivel"
          label="Combustível"
          value={form.combustivel}
          onChange={(combustivel) => setForm((f) => ({ ...f, combustivel }))}
        />
        <MoneyInput
          id="outros"
          label="Outros gastos"
          value={form.outrosGastos ?? 0}
          onChange={(outrosGastos) => setForm((f) => ({ ...f, outrosGastos }))}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="obs" className="text-sm font-medium">
          Observações
        </label>
        <textarea
          id="obs"
          rows={2}
          value={form.observacoes}
          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60 sm:grid-cols-5">
        <div>
          <dt className="text-xs text-slate-500">KM</dt>
          <dd className="font-semibold tabular-nums">{formatKm(live.km)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Ganhos</dt>
          <dd className="font-semibold tabular-nums text-emerald-600">{formatBRL(live.totalGanhos)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Gastos</dt>
          <dd className="font-semibold tabular-nums text-rose-600">{formatBRL(live.totalGastos)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Lucro</dt>
          <dd
            className={`font-semibold tabular-nums ${live.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {formatBRL(live.lucroLiquido)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Média/km</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(live.mediaGanhoPorKm)}</dd>
        </div>
      </dl>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-600" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {saving ? 'Salvando…' : editing ? 'Atualizar lançamento' : 'Salvar lançamento'}
      </button>
    </form>
  )
}
