import { useEffect, useState, type FormEvent } from 'react'
import type { Plan } from '../../types/admin'
import { supabase } from '../../services/supabase'

interface BillingSettings { grace_period_days: number; messages: Record<string, string>; maintenance_mode: boolean; email_from: string }
const DEFAULT_BILLING: BillingSettings = {
  grace_period_days: 7,
  maintenance_mode: false,
  email_from: '',
  messages: {
    '7d_before': 'Sua assinatura vence em 7 dias.',
    '3d_before': 'Faltam 3 dias para o vencimento da sua assinatura.',
    due_day: 'Sua assinatura vence hoje. Renove para manter o acesso.',
    '3d_late': 'Pagamento pendente: o acesso será suspenso em {days} dias.',
    blocked: 'Sua assinatura foi suspensa por falta de pagamento.',
  },
}

export function SettingsAdmin() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [billing, setBilling] = useState<BillingSettings>(DEFAULT_BILLING)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState(0)
  const [newPeriod, setNewPeriod] = useState(30)

  async function load() {
    if (!supabase) return
    const [planResult, settingResult] = await Promise.all([
      supabase.from('plans').select('id, name, description, price, period_days, features, is_active').order('price'),
      supabase.from('system_settings').select('value').eq('key', 'billing_settings').maybeSingle(),
    ])
    if (planResult.error || settingResult.error) {
      setError(planResult.error?.message ?? settingResult.error?.message ?? 'Falha ao carregar configurações.')
      return
    }
    setPlans((planResult.data ?? []) as Plan[])
    if (settingResult.data?.value) setBilling({ ...DEFAULT_BILLING, ...(settingResult.data.value as Partial<BillingSettings>) })
  }
  useEffect(() => { void load() }, [])

  async function savePlan(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault()
    if (!supabase) return
    const { error: updateError } = await supabase.from('plans').update({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      period_days: plan.period_days,
      is_active: plan.is_active,
    }).eq('id', plan.id)
    if (updateError) setError(updateError.message)
    else { setEditing(null); await load() }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${slug || 'plano'}-${crypto.randomUUID().slice(0, 8)}`
    const { error: insertError } = await supabase.from('plans').insert({
      id, name: newName.trim(), price: newPrice, period_days: newPeriod, is_active: true,
    })
    if (insertError) setError(insertError.message)
    else { setCreating(false); setNewName(''); setNewPrice(0); setNewPeriod(30); await load() }
  }

  async function saveBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const { error: saveError } = await supabase.from('system_settings').upsert({
      key: 'billing_settings',       value: billing, updated_at: new Date().toISOString(),
    })
    if (saveError) setError(saveError.message)
    else { setSaved(true); window.setTimeout(() => setSaved(false), 2500) }
  }

  return (
    <section className="space-y-6">
      <header><h2 className="text-2xl font-bold">Configurações do sistema</h2><p className="text-sm text-slate-500">Planos, tolerância de cobrança e modo de manutenção.</p></header>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Planos</h3><button type="button" onClick={() => setCreating((value) => !value)} className="rounded-lg border px-3 py-2 text-sm">{creating ? 'Cancelar' : 'Criar plano'}</button></div>
        {creating ? <form onSubmit={(event) => void createPlan(event)} className="card grid gap-3 p-4 sm:grid-cols-3"><label className="text-sm">Nome<input required maxLength={60} value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm">Preço (R$)<input required type="number" min={0} step="0.01" value={newPrice} onChange={(event) => setNewPrice(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm">Período (dias)<input required type="number" min={1} value={newPeriod} onChange={(event) => setNewPeriod(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label><button className="btn-primary rounded-lg px-4 py-2 text-sm sm:col-span-3">Criar plano</button></form> : null}
        {plans.map((plan) => editing === plan.id ? (
          <form key={plan.id} onSubmit={(event) => void savePlan(event, plan)} className="card grid gap-3 p-4 sm:grid-cols-2">
            <label className="text-sm">Nome<input required value={plan.name} onChange={(event) => setPlans((all) => all.map((item) => item.id === plan.id ? { ...item, name: event.target.value } : item))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm">Preço (R$)<input required type="number" min={0} step="0.01" value={plan.price} onChange={(event) => setPlans((all) => all.map((item) => item.id === plan.id ? { ...item, price: Number(event.target.value) } : item))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm">Período (dias)<input required type="number" min={1} value={plan.period_days} onChange={(event) => setPlans((all) => all.map((item) => item.id === plan.id ? { ...item, period_days: Number(event.target.value) } : item))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={plan.is_active} onChange={(event) => setPlans((all) => all.map((item) => item.id === plan.id ? { ...item, is_active: event.target.checked } : item))} /> Ativo</label>
            <div className="flex gap-2 sm:col-span-2"><button className="btn-primary rounded-lg px-4 py-2 text-sm">Salvar</button><button type="button" onClick={() => { setEditing(null); void load() }} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div>
          </form>
        ) : <article key={plan.id} className="card flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{plan.name} · R$ {Number(plan.price).toFixed(2).replace('.', ',')}</p><p className="text-sm text-slate-500">{plan.is_active ? 'Ativo' : 'Desativado'} · {plan.period_days} dias</p></div><button type="button" onClick={() => setEditing(plan.id)} className="rounded-lg border px-3 py-2 text-sm">Editar</button></article>)}
      </section>
      <form onSubmit={(event) => void saveBilling(event)} className="card space-y-4 p-4">
        <h3 className="text-lg font-semibold">Cobrança e sistema</h3>
        <label className="block text-sm">Dias de tolerância para suspensão<input type="number" min={1} max={30} value={billing.grace_period_days} onChange={(event) => setBilling((current) => ({ ...current, grace_period_days: Number(event.target.value) }))} className="mt-1 h-10 w-full max-w-xs rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={billing.maintenance_mode} onChange={(event) => setBilling((current) => ({ ...current, maintenance_mode: event.target.checked }))} /> Ativar modo de manutenção</label>
        <label className="block text-sm">Remetente de e-mail (deve estar verificado no Resend)<input value={billing.email_from} onChange={(event) => setBilling((current) => ({ ...current, email_from: event.target.value }))} placeholder="MotoristaConta &lt;avisos@seudominio.com&gt;" className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>
        <h4 className="font-medium">Mensagens automáticas</h4>
        {Object.entries(billing.messages).map(([key, text]) => <label key={key} className="block text-sm">{key}<input value={text} onChange={(event) => setBilling((current) => ({ ...current, messages: { ...current.messages, [key]: event.target.value } }))} className="mt-1 h-10 w-full rounded-lg border px-3 dark:border-slate-700 dark:bg-slate-950" /></label>)}
        {saved ? <p role="status" className="text-sm text-emerald-700">Configurações salvas.</p> : null}
        <button className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">Salvar configurações</button>
      </form>
    </section>
  )
}
