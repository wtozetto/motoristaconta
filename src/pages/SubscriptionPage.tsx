import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import type { Plan } from '../types/admin'
import { getAccessToken, supabase } from '../services/supabase'
import { ConfirmDialog } from '../components/ConfirmDialog'

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  pending: 'Aguardando pagamento',
  canceled: 'Cancelada',
  suspended: 'Suspensa',
  trial: 'Período de teste',
}

function dateIsInFuture(value: string | null): boolean {
  return value !== null && new Date(value).getTime() > Date.now()
}

export function SubscriptionPage() {
  const { subscription, refresh } = useSubscription()
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const navigate = useNavigate()
  const currentPlan = subscription?.plans?.[0]
    ?? plans.find((plan) => plan.id === subscription?.plan_id)
  const cancellationRequested = subscription?.status === 'active'
    && subscription.canceled_at !== null
  const cancellationScheduled = cancellationRequested
    && dateIsInFuture(subscription.next_billing_date)

  useEffect(() => {
    if (!supabase) return
    void supabase.from('plans').select('id, name, description, price, period_days, features, is_active')
      .eq('is_active', true).order('price')
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message)
        else setPlans((data ?? []) as Plan[])
      })
  }, [])

  async function selectPlan(plan: Plan) {
    setBusy(plan.id)
    setError(null)
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      })
      const result = await response.json() as { success?: boolean; checkoutUrl?: string | null; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error ?? 'Não foi possível iniciar a assinatura.')
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl)
      else {
        await refresh()
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível selecionar o plano.')
    } finally {
      setBusy(null)
    }
  }

  async function cancelSubscription() {
    setBusy('cancel')
    setError(null)
    try {
      const token = await getAccessToken()
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json() as { success?: boolean; cancelAt?: string; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error ?? 'Não foi possível cancelar a assinatura.')
      setConfirmCancel(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a assinatura.')
    } finally {
      setBusy(null)
    }
  }

  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">Assinaturas</h1>
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">Configure o Supabase para habilitar planos e pagamentos.</p>
        <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary rounded-xl px-4 py-2">Voltar ao aplicativo</button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold">Planos e assinatura</h1>
        <p className="mt-1 text-sm text-slate-500">Escolha um plano. Os pagamentos são processados com segurança pelo Mercado Pago.</p>
      </header>
      {subscription ? (
        <section className="card p-4">
          <h2 className="font-semibold">Assinatura atual: {currentPlan?.name ?? subscription.plan_id}</h2>
          <p className="mt-1 text-sm">
            Valor: {currentPlan?.price !== undefined ? `R$ ${Number(currentPlan.price).toFixed(2).replace('.', ',')}` : '—'}
            {' · '}Status: {cancellationScheduled
              ? 'Cancelamento agendado'
              : cancellationRequested
                ? 'Cancelada'
                : SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status}
            {' · '}Próximo vencimento: {subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('pt-BR') : '—'}
          </p>
          {cancellationScheduled && subscription.next_billing_date ? (
            <p className="mt-2 text-sm text-amber-800">
              Seu acesso permanece até {new Date(subscription.next_billing_date).toLocaleDateString('pt-BR')}. Não haverá novas cobranças.
            </p>
          ) : null}
          {subscription.status === 'active' && Number(currentPlan?.price ?? 0) > 0 && dateIsInFuture(subscription.next_billing_date) && !cancellationScheduled ? (
            <button type="button" onClick={() => setConfirmCancel(true)} className="btn-secondary mt-4 rounded-xl px-4 py-2 text-sm font-semibold">
              Cancelar ao fim do período
            </button>
          ) : null}
        </section>
      ) : null}
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      <section className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className="card flex flex-col p-5">
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-1 min-h-10 text-sm text-slate-500">{plan.description}</p>
            <p className="my-4 text-2xl font-bold">R$ {Number(plan.price).toFixed(2).replace('.', ',')}<span className="text-sm font-normal"> / {plan.period_days} dias</span></p>
            <ul className="mb-5 flex-1 space-y-2 text-sm">
              {(Array.isArray(plan.features) ? plan.features : []).map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <button type="button" onClick={() => void selectPlan(plan)} disabled={busy !== null || subscription?.plan_id === plan.id} className="btn-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50">
              {busy === plan.id ? 'Processando…' : subscription?.plan_id === plan.id ? 'Plano atual' : 'Selecionar plano'}
            </button>
          </article>
        ))}
      </section>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar assinatura?"
        confirmLabel={busy === 'cancel' ? 'Cancelando…' : 'Cancelar ao fim do período'}
        cancelLabel="Manter assinatura"
        danger
        confirmDisabled={busy !== null}
        onConfirm={() => void cancelSubscription()}
        onCancel={() => setConfirmCancel(false)}
      >
        A recorrência será encerrada para evitar novas cobranças, e seu acesso continuará até o próximo vencimento.
      </ConfirmDialog>
    </main>
  )
}
