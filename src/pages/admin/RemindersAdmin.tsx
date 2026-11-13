import { useEffect, useState } from 'react'
import type { DriverReminder } from '../../types/admin'
import { supabase } from '../../services/supabase'

type AdminReminder = DriverReminder & { profiles?: { name: string | null; email: string | null }[] }

interface BillingAlert {
  id: string
  user_id: string
  subscription_id: string
  alert_type: string
  billing_date: string
  sent_at: string
  channel: string
  profiles?: { name: string | null; email: string | null }[]
  subscriptions?: { plans?: { name: string }[] }[]
}

export function RemindersAdmin() {
  const [rows, setRows] = useState<AdminReminder[]>([])
  const [billingAlerts, setBillingAlerts] = useState<BillingAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase) return
    void Promise.all([
      supabase.from('reminders')
        .select('id, user_id, type, title, description, due_date, repeat_days, notify_days_before, is_active, profiles(name, email)')
        .eq('is_active', true).order('due_date').limit(200),
      supabase.from('billing_alerts')
        .select('id, user_id, subscription_id, alert_type, billing_date, sent_at, channel, profiles(name, email), subscriptions(plans(name))')
        .order('sent_at', { ascending: false }).limit(200),
    ]).then(([reminders, alerts]) => {
      const queryError = reminders.error ?? alerts.error
      if (queryError) setError(queryError.message)
      else {
        setRows((reminders.data ?? []) as AdminReminder[])
        setBillingAlerts((alerts.data ?? []) as BillingAlert[])
        setError(null)
      }
    })
  }, [])
  return (
    <section className="space-y-6">
      <header><h2 className="text-2xl font-bold">Cobrança e lembretes</h2><p className="text-sm text-slate-500">Avisos enviados sobre assinaturas e lembretes cadastrados pelos motoristas.</p></header>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Avisos de cobrança enviados</h3>
        <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Usuário', 'Plano', 'Tipo', 'Vencimento', 'Enviado em', 'Canal'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead>
          <tbody>{billingAlerts.map((row) => {
            const profile = row.profiles?.[0]
            const plan = row.subscriptions?.[0]?.plans?.[0]
            return <tr key={row.id} className="border-t dark:border-slate-800">
              <td className="p-3">{profile?.name || profile?.email || row.user_id}</td>
              <td className="p-3">{plan?.name ?? '—'}</td>
              <td className="p-3">{row.alert_type}</td>
              <td className="p-3">{new Date(`${row.billing_date}T00:00:00`).toLocaleDateString('pt-BR')}</td>
              <td className="p-3">{new Date(row.sent_at).toLocaleString('pt-BR')}</td>
              <td className="p-3">{row.channel}</td>
            </tr>
          })}</tbody>
        </table></div>
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Lembretes ativos dos usuários</h3>
        <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Usuário', 'Lembrete', 'Tipo', 'Vencimento', 'Aviso prévio'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead><tbody>{rows.map((row) => { const profile = row.profiles?.[0]; return <tr key={row.id} className="border-t dark:border-slate-800"><td className="p-3">{profile?.name || profile?.email || row.user_id}</td><td className="p-3">{row.title}</td><td className="p-3">{row.type}</td><td className="p-3">{new Date(row.due_date).toLocaleDateString('pt-BR')}</td><td className="p-3">{row.notify_days_before} dias</td></tr> })}</tbody></table></div>
      </section>
    </section>
  )
}
