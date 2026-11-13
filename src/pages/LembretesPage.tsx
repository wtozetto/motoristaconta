import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MoneyInput } from '../components/MoneyInput'
import { useData } from '../data/DataContext'
import { formatBRL, formatDateISO } from '../lib/format'
import { diasAteVencimento, getDueMessage } from '../hooks/useReminders'
import { useReminders } from '../hooks/useReminders'
import type { ContaFixa, ContaFixaInput } from '../types'
import { useTheme } from '../theme/ThemeContext'
import { exportarListaLembretesPDF } from '../utils/pdfExport'

const TIPOS: Array<{ value: ContaFixa['tipo']; label: string }> = [
  { value: 'seguro', label: 'Seguro' },
  { value: 'ipva', label: 'IPVA' },
  { value: 'licenciamento', label: 'Licenciamento' },
  { value: 'parcelas', label: 'Parcelas' },
  { value: 'troca_oleo', label: 'Troca de óleo' },
  { value: 'revisao', label: 'Revisão' },
  { value: 'outros', label: 'Outros' },
]

const EMPTY_FORM: ContaFixaInput = {
  titulo: '',
  tipo: 'seguro',
  valor: 0,
  dataVencimento: '',
  observacao: '',
  status: 'pendente',
}

const urgencyStyle: Record<string, string> = {
  vencido: 'border-l-4 border-rose-300 border-l-rose-500 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  vence_hoje: 'border-l-4 border-amber-300 border-l-amber-600 bg-amber-50 text-amber-900 shadow-[0_0_12px_rgba(212,175,55,0.2)] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  proximo: 'border-l-4 border-amber-300 border-l-amber-500 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  ok: 'border-l-4 border-emerald-200 border-l-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
}

export function LembretesPage() {
  const { contasFixas, manutencoes, saveContaFixa, removeContaFixa } = useData()
  const { settings } = useTheme()
  const [form, setForm] = useState<ContaFixaInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ContaFixa | null>(null)

  const sortedContas = useMemo(
    () => [...contasFixas].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento)),
    [contasFixas],
  )
  const reminders = useReminders(contasFixas, manutencoes, settings.alertaManutencaoDias)
  const dueItems = useMemo(() => reminders.filter((item) => item.diasRestantes <= 0), [reminders])

  useEffect(() => {
    if (!settings.notificacoesVencimento || !('Notification' in window)) return

    let active = true
    const showNotifications = async () => {
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (!active || permission !== 'granted') return

      for (const item of dueItems) {
        const key = `motoristaconta.notification.${item.tipo}.${item.id}.${item.dataVencimento}`
        if (sessionStorage.getItem(key)) continue
        const target =
          item.tipo === 'conta'
            ? `/lembretes#lembrete-conta-${encodeURIComponent(item.id)}`
            : `/manutencao#manutencao-${encodeURIComponent(item.id)}`
        const notification = new Notification(
          item.diasRestantes === 0 ? `Vence hoje: ${item.titulo}` : `Vencimento atrasado: ${item.titulo}`,
          { body: getDueMessage(item.diasRestantes).mensagem, tag: key, data: { target } },
        )
        notification.onclick = () => {
          window.focus()
          window.location.assign(notification.data.target)
          notification.close()
        }
        sessionStorage.setItem(key, 'shown')
      }
    }

    void showNotifications()
    return () => {
      active = false
    }
  }, [dueItems, settings.notificacoesVencimento])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveContaFixa(form)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o vencimento.')
    } finally {
      setSaving(false)
    }
  }

  async function togglePago(conta: ContaFixa) {
    setError(null)
    try {
      await saveContaFixa(
        {
          titulo: conta.titulo,
          tipo: conta.tipo,
          valor: conta.valor,
          dataVencimento: conta.dataVencimento,
          observacao: conta.observacao,
          status: conta.status === 'pago' ? 'pendente' : 'pago',
        },
        conta.id,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o vencimento.')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Lembretes e vencimentos</h1>
        <p className="text-sm text-slate-500">
          Cadastre contas do veículo e acompanhe os prazos em ordem de vencimento.
        </p>
        <button
          type="button"
          onClick={() =>
            exportarListaLembretesPDF(
              reminders.map((item) => ({
                data: item.dataVencimento,
                titulo: item.titulo,
                mensagem: item.mensagem,
                valor: item.valor,
              })),
            )
          }
          className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900"
        >
          Exportar lembretes em PDF
        </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="card space-y-4 p-4"
      >
        <h2 className="font-semibold">Novo vencimento</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Título
            <input
              required
              value={form.titulo}
              onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))}
              placeholder="Ex.: Seguro do carro"
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="text-sm">
            Tipo
            <select
              value={form.tipo}
              onChange={(event) =>
                setForm((current) => ({ ...current, tipo: event.target.value as ContaFixa['tipo'] }))
              }
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </label>
          <MoneyInput
            id="lembrete-valor"
            label="Valor (R$)"
            value={form.valor}
            onChange={(valor) => setForm((current) => ({ ...current, valor }))}
          />
          <label className="text-sm">
            Data de vencimento
            <input
              required
              type="date"
              value={form.dataVencimento}
              onChange={(event) =>
                setForm((current) => ({ ...current, dataVencimento: event.target.value }))
              }
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
        </div>
        <label className="block text-sm">
          Observação
          <textarea
            rows={2}
            value={form.observacao}
            onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Adicionar vencimento'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Contas cadastradas ({sortedContas.length})</h2>
        {sortedContas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
            Nenhum vencimento cadastrado.
          </p>
        ) : (
          sortedContas.map((conta) => {
            const days = diasAteVencimento(conta.dataVencimento)
            const due = conta.status === 'pago'
              ? { status: 'ok' as const, mensagem: 'Pago' }
              : getDueMessage(days)
            const tipo = TIPOS.find((item) => item.value === conta.tipo)?.label ?? 'Outros'
            return (
              <article
                key={conta.id}
                id={`lembrete-conta-${conta.id}`}
                className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${urgencyStyle[due.status]}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{conta.titulo}</h3>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-slate-900/70">{tipo}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    {formatDateISO(conta.dataVencimento)} ·{' '}
                    <span className="font-semibold text-gastos-escuro">{formatBRL(conta.valor)}</span>
                    {' · '}{due.mensagem}
                  </p>
                  {conta.observacao ? <p className="mt-1 text-xs opacity-80">{conta.observacao}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void togglePago(conta)}
                    className="rounded-lg border border-current px-3 py-2 text-xs font-semibold"
                  >
                    {conta.status === 'pago' ? 'Marcar pendente' : 'Marcar como pago'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(conta)}
                    className="rounded-lg border border-rose-400 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            )
          })
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir vencimento?"
        confirmLabel="Excluir"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await removeContaFixa(pendingDelete.id)
          setPendingDelete(null)
        }}
      >
        O lembrete será removido permanentemente.
      </ConfirmDialog>
    </div>
  )
}
