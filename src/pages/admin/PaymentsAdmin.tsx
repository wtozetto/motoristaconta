import { useEffect, useState } from 'react'
import { formatBRL } from '../../lib/format'
import type { Payment } from '../../types/admin'
import { supabase } from '../../services/supabase'

export function PaymentsAdmin() {
  const [rows, setRows] = useState<Payment[]>([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase) return
    let request = supabase.from('payments')
      .select('id, subscription_id, user_id, amount, status, payment_date, due_date, invoice_url, profiles(name, email)')
      .order('created_at', { ascending: false }).limit(200)
    if (filter !== 'all') request = request.eq('status', filter)
    void request.then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message)
      else setRows((data ?? []) as Payment[])
    })
  }, [filter])

  return (
    <section className="space-y-4">
      <header><h2 className="text-2xl font-bold">Pagamentos</h2><p className="text-sm text-slate-500">Histórico recente recebido pelo webhook.</p></header>
      <select aria-label="Status do pagamento" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border bg-white px-3 dark:border-slate-700 dark:bg-slate-900">{['all', 'paid', 'pending', 'failed', 'refunded', 'expired'].map((status) => <option key={status} value={status}>{status === 'all' ? 'Todos os status' : status}</option>)}</select>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Usuário', 'Valor', 'Status', 'Data do pagamento', 'Vencimento', 'Fatura'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead>
        <tbody>{rows.map((row) => { const profile = row.profiles?.[0]; return <tr key={row.id} className="border-t dark:border-slate-800"><td className="p-3">{profile?.name || profile?.email || row.user_id}</td><td className="p-3">{formatBRL(Number(row.amount))}</td><td className="p-3">{row.status}</td><td className="p-3">{row.payment_date ? new Date(row.payment_date).toLocaleString('pt-BR') : '—'}</td><td className="p-3">{new Date(row.due_date).toLocaleDateString('pt-BR')}</td><td className="p-3">{row.invoice_url ? <a href={row.invoice_url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Abrir</a> : '—'}</td></tr> })}</tbody>
      </table></div>
    </section>
  )
}
