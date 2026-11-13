import { useEffect, useState } from 'react'
import type { DriverReminder } from '../../types/admin'
import { supabase } from '../../services/supabase'

type AdminReminder = DriverReminder & { profiles?: { name: string | null; email: string | null }[] }

export function RemindersAdmin() {
  const [rows, setRows] = useState<AdminReminder[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase) return
    void supabase.from('reminders')
      .select('id, user_id, type, title, description, due_date, repeat_days, notify_days_before, is_active, profiles(name, email)')
      .eq('is_active', true).order('due_date').limit(200)
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message)
        else setRows((data ?? []) as AdminReminder[])
      })
  }, [])
  return (
    <section className="space-y-4">
      <header><h2 className="text-2xl font-bold">Lembretes dos usuários</h2><p className="text-sm text-slate-500">Próximos lembretes ativos cadastrados pelos motoristas.</p></header>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr>{['Usuário', 'Lembrete', 'Tipo', 'Vencimento', 'Aviso prévio'].map((col) => <th key={col} className="p-3">{col}</th>)}</tr></thead><tbody>{rows.map((row) => { const profile = row.profiles?.[0]; return <tr key={row.id} className="border-t dark:border-slate-800"><td className="p-3">{profile?.name || profile?.email || row.user_id}</td><td className="p-3">{row.title}</td><td className="p-3">{row.type}</td><td className="p-3">{new Date(row.due_date).toLocaleDateString('pt-BR')}</td><td className="p-3">{row.notify_days_before} dias</td></tr> })}</tbody></table></div>
    </section>
  )
}
