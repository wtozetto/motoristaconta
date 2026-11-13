import { useEffect, useState } from 'react'
import type { Subscription } from '../../types/admin'
import { supabase } from '../../services/supabase'

const STATUSES = ['active', 'pending', 'suspended', 'canceled', 'trial']

export function SubscriptionsAdmin() {
  const [rows, setRows] = useState<Subscription[]>([])
  const [status, setStatus] = useState('all')
  const [due, setDue] = useState('all')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!supabase) return
    let request = supabase.from('subscriptions')
      .select('id, user_id, plan_id, status, start_date, next_billing_date, canceled_at, plans(name, price), profiles(name, email)')
      .order('next_billing_date', { ascending: true })
    if (status !== 'all') request = request.eq('status', status)
    if (due !== 'all') {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      if (due === 'today') end.setDate(end.getDate() + 1)
      else if (due === 'week') end.setDate(end.getDate() + 7)
      else { start.setDate(1); end.setMonth(end.getMonth() + 1); end.setDate(1) }
      request = request.gte('next_billing_date', start.toISOString()).lt('next_billing_date', end.toISOString())
    }
    const { data, error: queryError } = await request
    if (queryError) setError(queryError.message)
    else { setRows((data ?? []) as Subscription[]); setError(null) }
  }
  useEffect(() => { void load() }, [status, due])

  async function updateStatus(row: Subscription, next: string) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('subscriptions').update({
      status: next,
      canceled_at: next === 'canceled' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    if (updateError) setError(updateError.message)
    else await load()
  }

  return (
    <section className="space-y-4">
      <header><h2 className="text-2xl font-bold">Assinaturas</h2><p className="text-sm text-slate-500">Acompanhe vencimentos e estados de cobrança.</p></header>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="all">Todos os status</option>{STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Vencimento" value={due} onChange={(event) => setDue(event.target.value)} className="h-10 rounded-lg border bg-white px-3 dark:border-slate-700 dark:bg-slate-900"><option value="all">Qualquer vencimento</option><option value="today">Hoje</option><option value="week">Esta semana</option><option value="month">Este mês</option></select>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[780px] text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Usuário', 'Plano', 'Valor', 'Próximo vencimento', 'Status', 'Ação'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead>
        <tbody>{rows.map((row) => { const profile = row.profiles?.[0]; const plan = row.plans?.[0]; return <tr key={row.id} className="border-t dark:border-slate-800"><td className="p-3">{profile?.name || profile?.email || row.user_id}</td><td className="p-3">{plan?.name ?? row.plan_id}</td><td className="p-3">R$ {Number(plan?.price ?? 0).toFixed(2).replace('.', ',')}</td><td className="p-3">{row.next_billing_date ? new Date(row.next_billing_date).toLocaleDateString('pt-BR') : '—'}</td><td className="p-3">{row.status}</td><td className="p-3"><select aria-label={`Alterar status ${row.id}`} value={row.status} onChange={(event) => void updateStatus(row, event.target.value)} className="rounded-lg border bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">{STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></td></tr> })}</tbody>
      </table></div>
    </section>
  )
}
