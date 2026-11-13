import { useEffect, useMemo, useState } from 'react'
import type { CombustivelItem, CombustivelTipo, Registro, RegistroInput } from '../types'
import { COMBUSTIVEL_LABEL } from '../types'
import { deriveRegistro } from '../lib/calculations'
import { formatBRL, formatKm, todayISO } from '../lib/format'
import { buildCombustivelAggregate, getCombustiveisList } from '../lib/fuel'
import { validateRegistro } from '../lib/validation'
import { MoneyInput } from './MoneyInput'

const defaultFuelItem = (): CombustivelItem => ({
  tipo: 'gasolina',
  valor: 0,
  litros: undefined,
})

const emptyInput = (): RegistroInput => ({
  data: todayISO(),
  kmInicial: 0,
  kmFinal: 0,
  ganhos: { uber: 0, noventaenove: 0, indrive: 0 },
  combustivel: { tipo: 'gasolina', valor: 0 },
  combustiveis: [defaultFuelItem()],
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
  const [combustiveis, setCombustiveis] = useState<CombustivelItem[]>([defaultFuelItem()])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setForm(emptyInput())
      setCombustiveis([defaultFuelItem()])
      return
    }

    const list = getCombustiveisList(editing)
    const normalizedList: CombustivelItem[] =
      list.length > 0
        ? list.map((item) => ({
            ...item,
            tipo: (item.tipo === 'nao_informado' ? 'gasolina' : item.tipo) as CombustivelTipo,
          }))
        : [defaultFuelItem()]

    setCombustiveis(normalizedList)
    setForm({
      data: editing.data,
      kmInicial: editing.kmInicial,
      kmFinal: editing.kmFinal,
      ganhos: { ...editing.ganhos },
      combustivel: editing.combustivel,
      combustiveis: normalizedList,
      outrosGastos: editing.outrosGastos ?? 0,
      observacoes: editing.observacoes,
    })
  }, [editing])

  const aggregateCombustivel = useMemo(
    () => buildCombustivelAggregate(combustiveis),
    [combustiveis],
  )

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
        combustivel: aggregateCombustivel.combustivel,
        combustiveis,
        outrosGastos: form.outrosGastos ?? 0,
      }),
    [aggregateCombustivel.combustivel, combustiveis, form],
  )

  function updateCombustivel(index: number, patch: Partial<CombustivelItem>) {
    setCombustiveis((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  function handleAddCombustivel() {
    setCombustiveis((prev) => [...prev, defaultFuelItem()])
  }

  function handleRemoveCombustivel(index: number) {
    setCombustiveis((prev) => {
      if (prev.length <= 1) return [defaultFuelItem()]
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const agg = buildCombustivelAggregate(combustiveis)
    const payload: RegistroInput = {
      ...form,
      combustivel: agg.combustivel,
      combustiveis: agg.combustiveis,
    }

    const nextErrors = validateRegistro(payload)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return

    setSaving(true)
    try {
      await onSubmit(payload, editing?.id)
      if (!editing) {
        setForm(emptyInput())
        setCombustiveis([defaultFuelItem()])
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Não foi possível salvar.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card space-y-4 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">
          {editing ? 'Editar lançamento' : 'Novo lançamento'}
        </h2>
        {editing ? (
          <button
            type="button"
            className="text-sm text-slate-500 underline"
            onClick={onCancelEdit}
          >
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

      {/* Seção Combustível */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Combustível</h3>
            <p className="text-xs text-slate-500">
              Escolha o tipo abastecido e o valor. Litros permitem calcular autonomia e preço médio.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddCombustivel}
            className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            + Outro abastecimento
          </button>
        </div>

        {combustiveis.map((item, index) => {
          const precoLitro =
            item.valor > 0 && item.litros && item.litros > 0 ? item.valor / item.litros : null

          return (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {combustiveis.length > 1
                    ? `Abastecimento #${index + 1}`
                    : 'Tipo de combustível (obrigatório com valor)'}
                </span>
                {combustiveis.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveCombustivel(index)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remover
                  </button>
                ) : null}
              </div>

              {/* Controle segmentado com exatamente 3 opções: Etanol, Gasolina, Diesel */}
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label={`Tipo de combustível ${index + 1}`}
              >
                {(['etanol', 'gasolina', 'diesel'] as const).map((tipo) => {
                  const isSelected = item.tipo === tipo
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => updateCombustivel(index, { tipo })}
                      className={`h-10 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                        isSelected
                          ? tipo === 'etanol'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : tipo === 'gasolina'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-blue-600 text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {COMBUSTIVEL_LABEL[tipo]}
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MoneyInput
                  id={`combustivel-valor-${index}`}
                  label="Valor gasto em R$"
                  value={item.valor}
                  onChange={(valor) => updateCombustivel(index, { valor })}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`litros-${index}`} className="text-sm font-medium">
                      Litros abastecidos <span className="text-xs font-normal text-slate-400">(opcional)</span>
                    </label>
                    {precoLitro ? (
                      <span className="text-xs font-semibold text-gastos-escuro">
                        {formatBRL(precoLitro)}/L
                      </span>
                    ) : null}
                  </div>
                  <input
                    id={`litros-${index}`}
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ex: 25.50"
                    value={item.litros ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value)
                      updateCombustivel(index, { litros: val })
                    }}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>
          )
        })}

        <div>
          <MoneyInput
            id="outros"
            label="Outros gastos (pedágio, alimentação, lavagem, etc.)"
            value={form.outrosGastos ?? 0}
            onChange={(outrosGastos) => setForm((f) => ({ ...f, outrosGastos }))}
          />
        </div>
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
          <dd className="font-semibold tabular-nums text-emerald-600">
            {formatBRL(live.totalGanhos)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Gastos</dt>
          <dd className="font-semibold tabular-nums text-gastos-escuro">
            {formatBRL(live.totalGastos)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Lucro</dt>
          <dd
            className={`font-semibold tabular-nums ${
              live.lucroLiquido >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
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
        className="btn-primary h-11 w-full rounded-xl text-sm font-semibold disabled:opacity-60"
      >
        {saving ? 'Salvando…' : editing ? 'Atualizar lançamento' : 'Salvar lançamento'}
      </button>
    </form>
  )
}
