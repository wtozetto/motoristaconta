import { useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { useTheme } from '../theme/ThemeContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MoneyInput } from '../components/MoneyInput'
import { formatBRL, formatDateISO, formatKm, todayISO } from '../lib/format'
import {
  calculateManutencaoMetrics,
  getAllManutencaoAlertas,
  getKmAtual,
} from '../lib/maintenance'
import { validateManutencao } from '../lib/validation'
import {
  MANUTENCAO_CATEGORIAS,
  type Manutencao,
  type ManutencaoInput,
  type ManutencaoStatus,
  type SeguroSubcategoria,
} from '../types'
import { exportarHistoricoVeiculoPDF } from '../utils/pdfExport'

const emptyManutencaoInput = (kmAtual = 0): ManutencaoInput => ({
  data: todayISO(),
  categoria: 'Troca de óleo',
  descricao: '',
  valor: 0,
  kmRealizacao: kmAtual,
  proximaData: '',
  proximaKm: kmAtual > 0 ? kmAtual + 10000 : undefined,
  oficina: '',
  observacoes: '',
  status: 'concluido',
})

type FilterTab = 'todas' | 'alertas' | 'concluido' | 'programado'

export function ManutencaoPage() {
  const { manutencoes, registros, categoriasManutencao, saveManutencao, removeManutencao } = useData()
  const { settings } = useTheme()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Manutencao | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Manutencao | null>(null)
  const [filterTab, setFilterTab] = useState<FilterTab>('todas')
  const [searchTerm, setSearchTerm] = useState('')

  const kmAtual = useMemo(() => getKmAtual(registros, manutencoes), [registros, manutencoes])

  const alertas = useMemo(
    () => getAllManutencaoAlertas(manutencoes, kmAtual, settings),
    [manutencoes, kmAtual, settings],
  )

  const alertMap = useMemo(() => {
    const map = new Map<string, (typeof alertas)[number]>()
    for (const a of alertas) {
      map.set(a.manutencao.id, a)
    }
    return map
  }, [alertas])

  const metrics = useMemo(
    () => calculateManutencaoMetrics(manutencoes, kmAtual, settings),
    [manutencoes, kmAtual, settings],
  )

  const filtered = useMemo(() => {
    return manutencoes
      .filter((m) => {
        if (filterTab === 'alertas') {
          const alerta = alertMap.get(m.id)
          if (!alerta || (alerta.status !== 'atrasado' && alerta.status !== 'proximo')) {
            return false
          }
        } else if (filterTab === 'concluido' || filterTab === 'programado') {
          if (m.status !== filterTab) return false
        }

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase()
          const matchCat = m.categoria.toLowerCase().includes(term)
          const matchDesc = m.descricao.toLowerCase().includes(term)
          const matchOficina = (m.oficina ?? '').toLowerCase().includes(term)
          return matchCat || matchDesc || matchOficina
        }

        return true
      })
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [alertMap, filterTab, manutencoes, searchTerm])

  function handleEdit(m: Manutencao) {
    setEditing(m)
    setIsFormOpen(true)
  }

  function handleCancelForm() {
    setIsFormOpen(false)
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manutenção Veicular</h1>
          <p className="text-sm text-slate-500">
            Controle preventivo de revisões, trocas de óleo, pneus e despesas com a oficina.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportarHistoricoVeiculoPDF(
                manutencoes.map((item) => ({
                  data: item.data,
                  categoria: item.categoria,
                  descricao: item.descricao,
                  valor: item.valor,
                  km: item.kmRealizacao,
                  oficina: item.oficina,
                })),
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-800"
          >
            Exportar PDF
          </button>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
            <span className="text-slate-400">KM atual:</span>{' '}
            <span className="text-emerald-600 dark:text-emerald-400">{formatKm(kmAtual)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setIsFormOpen(true)
            }}
            className="btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
          >
            + Nova manutenção
          </button>
        </div>
      </header>

      {/* Cards de Métricas e Alertas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <span className="text-xs text-slate-500">Total investido</span>
          <p className="mt-1 text-2xl font-bold text-gastos-escuro tabular-nums">
            {formatBRL(metrics.totalGasto)}
          </p>
          <span className="text-xs text-slate-400">{metrics.totalItens} serviço(s)</span>
        </div>

        <div className="card p-4">
          <span className="text-xs text-slate-500">Atrasadas</span>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              metrics.atrasadasCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.atrasadasCount}
          </p>
          <span className="text-xs text-slate-400">Requerem troca imediata</span>
        </div>

        <div className="card p-4">
          <span className="text-xs text-slate-500">Próximas (atenção)</span>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              metrics.proximasCount > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'
            }`}
          >
            {metrics.proximasCount}
          </p>
          <span className="text-xs text-slate-400">
            ≤ {settings.alertaManutencaoDias} dias ou {settings.alertaManutencaoKm} km
          </span>
        </div>

        <div className="card p-4">
          <span className="text-xs text-slate-500">KM do veículo</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatKm(kmAtual)}
          </p>
          <span className="text-xs text-slate-400">Odômetro mais recente</span>
        </div>
      </div>

      {/* Banner de alertas críticos */}
      {metrics.atrasadasCount > 0 || metrics.proximasCount > 0 ? (
        <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Alertas de manutenção preventiva
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {alertas
              .filter((a) => a.status === 'atrasado' || a.status === 'proximo')
              .map((a) => (
                <div
                  key={a.manutencao.id}
                  className={`rounded-xl border p-3 text-xs ${
                    a.status === 'atrasado'
                      ? 'border-rose-200 bg-white text-rose-900 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-200'
                      : 'border-amber-200 bg-white text-amber-900 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{a.manutencao.categoria}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        a.status === 'atrasado'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {a.status === 'atrasado' ? 'Atrasado' : 'Próximo'}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300 line-clamp-1">
                    {a.manutencao.descricao}
                  </p>
                  <p className="mt-1 font-semibold">{a.detalhe}</p>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* Formulário Modal / Collapsible */}
      {isFormOpen ? (
        <ManutencaoForm
          editing={editing}
          kmAtual={kmAtual}
          customCategories={categoriasManutencao}
          onCancel={handleCancelForm}
          onSubmit={async (input, id) => {
            await saveManutencao(input, id)
            handleCancelForm()
          }}
        />
      ) : null}

      {/* Filtros e Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            [
              ['todas', 'Todas'],
              ['alertas', 'Com alertas'],
              ['concluido', 'Concluídas'],
              ['programado', 'Programadas'],
            ] as [FilterTab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filterTab === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Buscar por categoria, serviço, oficina…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:w-72 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {/* Tabela de Histórico */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Nenhuma manutenção encontrada neste filtro.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-3 font-semibold">Alerta</th>
                <th className="px-3 py-3 font-semibold">Data</th>
                <th className="px-3 py-3 font-semibold">KM Realização</th>
                <th className="px-3 py-3 font-semibold">Serviço / Categoria</th>
                <th className="px-3 py-3 font-semibold">Valor</th>
                <th className="px-3 py-3 font-semibold">Próxima manutenção</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const alerta = alertMap.get(m.id)
                const isAtrasado = alerta?.status === 'atrasado'
                const isProximo = alerta?.status === 'proximo'

                return (
                  <tr
                    key={m.id}
                    id={`manutencao-${m.id}`}
                    className="border-t border-slate-100 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isAtrasado
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : isProximo
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isAtrasado
                              ? 'bg-rose-500'
                              : isProximo
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                          }`}
                        />
                        {isAtrasado ? 'Atrasado' : isProximo ? 'Próximo' : 'Em dia'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-medium">{formatDateISO(m.data)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatKm(m.kmRealizacao)}</td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        {m.categoria}
                      </span>
                      {m.categoria === 'Seguro' && m.seguroSubcategoria ? (
                        <span className="text-[11px] text-slate-500">
                          {m.seguroSubcategoria === 'franquia' ? 'Franquia' : 'Mensalidade'}
                        </span>
                      ) : null}
                      <span className="text-xs text-slate-500 line-clamp-1">{m.descricao}</span>
                      {m.oficina ? (
                        <span className="text-[11px] text-slate-400 block">Oficina: {m.oficina}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-gastos-escuro">
                      {formatBRL(m.valor)}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {m.proximaData ? (
                        <div className="font-medium">Data: {formatDateISO(m.proximaData)}</div>
                      ) : null}
                      {m.proximaKm !== undefined ? (
                        <div className="tabular-nums text-slate-500">KM: {formatKm(m.proximaKm)}</div>
                      ) : null}
                      {alerta?.detalhe ? (
                        <div
                          className={`mt-0.5 text-[11px] font-medium ${
                            isAtrasado
                              ? 'text-rose-600'
                              : isProximo
                                ? 'text-amber-600'
                                : 'text-slate-400'
                          }`}
                        >
                          {alerta.detalhe}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                          m.status === 'concluido'
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {m.status === 'concluido' ? 'Concluído' : 'Programado'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(m)}
                          className="text-xs font-semibold text-slate-700 underline dark:text-slate-200"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(m)}
                          className="text-xs font-semibold text-rose-600 underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir registro de manutenção?"
        confirmLabel="Excluir"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeManutencao(pendingDelete.id)
          setPendingDelete(null)
        }}
      >
        Esta manutenção será removida permanentemente do histórico do veículo.
      </ConfirmDialog>
    </div>
  )
}

interface ManutencaoFormProps {
  editing?: Manutencao | null
  kmAtual: number
  customCategories: string[]
  onCancel: () => void
  onSubmit: (input: ManutencaoInput, id?: string) => Promise<void>
}

function ManutencaoForm({ editing, kmAtual, customCategories, onCancel, onSubmit }: ManutencaoFormProps) {
  const [form, setForm] = useState<ManutencaoInput>(() =>
    editing
      ? {
          data: editing.data,
          categoria: editing.categoria,
          seguroSubcategoria: editing.seguroSubcategoria,
          descricao: editing.descricao,
          valor: editing.valor,
          kmRealizacao: editing.kmRealizacao,
          proximaData: editing.proximaData ?? '',
          proximaKm: editing.proximaKm,
          oficina: editing.oficina ?? '',
          observacoes: editing.observacoes ?? '',
          status: editing.status,
        }
      : emptyManutencaoInput(kmAtual),
  )

  const [isCustomCategory, setIsCustomCategory] = useState(
    Boolean(
      editing?.categoria &&
        !MANUTENCAO_CATEGORIAS.includes(editing.categoria as (typeof MANUTENCAO_CATEGORIAS)[number]),
    ),
  )
  const [customCategory, setCustomCategory] = useState(
    isCustomCategory ? editing?.categoria ?? '' : '',
  )
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const categoryOptions = [...new Set([...MANUTENCAO_CATEGORIAS, ...customCategories])]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const finalCategory = isCustomCategory ? customCategory.trim() || 'Outros' : form.categoria
    const payload: ManutencaoInput = {
      ...form,
      categoria: finalCategory,
      seguroSubcategoria: finalCategory === 'Seguro' ? form.seguroSubcategoria ?? 'mensalidade' : undefined,
      proximaData: form.proximaData?.trim() || undefined,
      proximaKm:
        form.proximaKm !== undefined && form.proximaKm !== null && !isNaN(Number(form.proximaKm))
          ? Number(form.proximaKm)
          : undefined,
    }

    const nextErrors = validateManutencao(payload)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return

    setSaving(true)
    try {
      await onSubmit(payload, editing?.id)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Não foi possível salvar a manutenção.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-emerald-500/30 bg-white p-5 shadow-lg dark:border-emerald-500/20 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {editing ? 'Editar Manutenção' : 'Nova Manutenção Veicular'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 hover:underline"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="m-data" className="text-sm font-medium">
            Data da realização <span className="text-rose-500">*</span>
          </label>
          <input
            id="m-data"
            type="date"
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="m-km" className="text-sm font-medium">
            KM na realização <span className="text-rose-500">*</span>
          </label>
          <input
            id="m-km"
            type="number"
            min={0}
            step={1}
            value={form.kmRealizacao}
            onChange={(e) => setForm((f) => ({ ...f, kmRealizacao: Number(e.target.value) }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <MoneyInput
          id="m-valor"
          label="Valor total (R$)"
          value={form.valor}
          onChange={(valor) => setForm((f) => ({ ...f, valor }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="m-cat" className="text-sm font-medium">
            Categoria do serviço <span className="text-rose-500">*</span>
          </label>
          <select
            id="m-cat"
            value={isCustomCategory ? 'OUTROS_CUSTOM' : form.categoria}
            onChange={(e) => {
              if (e.target.value === 'OUTROS_CUSTOM') {
                setIsCustomCategory(true)
              } else {
                setIsCustomCategory(false)
                setForm((f) => ({
                  ...f,
                  categoria: e.target.value,
                  seguroSubcategoria: e.target.value === 'Seguro' ? f.seguroSubcategoria ?? 'mensalidade' : undefined,
                }))
              }
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          >
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'Seguro' ? '🚗 Seguro' : cat}
              </option>
            ))}
            <option value="OUTROS_CUSTOM">Outra categoria personalizada…</option>
          </select>
          {form.categoria === 'Seguro' && !isCustomCategory ? (
            <label htmlFor="m-seguro-subcategoria" className="mt-2 text-sm font-medium">
              Tipo de seguro
              <select
                id="m-seguro-subcategoria"
                value={form.seguroSubcategoria ?? 'mensalidade'}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    seguroSubcategoria: e.target.value as SeguroSubcategoria,
                  }))
                }
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="mensalidade">Mensalidade</option>
                <option value="franquia">Franquia</option>
              </select>
            </label>
          ) : null}
          {isCustomCategory ? (
            <input
              type="text"
              placeholder="Digite o nome da categoria…"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="mt-1 h-10 rounded-xl border border-slate-200 px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="m-status" className="text-sm font-medium">
            Status da manutenção <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['concluido', 'Concluído'],
                ['programado', 'Programado'],
              ] as [ManutencaoStatus, string][]
            ).map(([st, label]) => (
              <button
                key={st}
                type="button"
                onClick={() => setForm((f) => ({ ...f, status: st }))}
                className={`h-11 rounded-xl text-xs font-semibold transition-all ${
                  form.status === st
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="m-desc" className="text-sm font-medium">
          O que foi realizado / descrição <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="m-desc"
          rows={2}
          placeholder="Ex: Troca de óleo 5W30 Sintético + filtro de óleo e filtro de ar do motor"
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      {/* Bloco de Alertas para Próxima Manutenção */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div>
          <h3 className="text-sm font-semibold">Previsão da próxima manutenção (Alertas)</h3>
          <p className="text-xs text-slate-500">
            Informe a próxima data ou o próximo KM (pelo menos um) para o app calcular alertas automáticos.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="m-prox-data" className="text-sm font-medium">
              Data da próxima manutenção
            </label>
            <input
              id="m-prox-data"
              type="date"
              value={form.proximaData}
              onChange={(e) => setForm((f) => ({ ...f, proximaData: e.target.value }))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="m-prox-km" className="text-sm font-medium">
              KM da próxima manutenção
            </label>
            <input
              id="m-prox-km"
              type="number"
              min={0}
              step={1}
              placeholder="Ex: 85000"
              value={form.proximaKm ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  proximaKm: e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="m-oficina" className="text-sm font-medium">
            Oficina / local <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            id="m-oficina"
            type="text"
            placeholder="Ex: Auto Mecânica Silva"
            value={form.oficina}
            onChange={(e) => setForm((f) => ({ ...f, oficina: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="m-obs" className="text-sm font-medium">
            Notas / observações <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            id="m-obs"
            type="text"
            placeholder="Ex: Garantia de 6 meses nas peças"
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-600" role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary h-11 rounded-xl px-6 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Salvando…' : editing ? 'Atualizar manutenção' : 'Salvar manutenção'}
        </button>
      </div>
    </form>
  )
}
