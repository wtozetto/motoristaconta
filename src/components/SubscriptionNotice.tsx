import { useSubscription } from '../hooks/useSubscription'

export function SubscriptionNotice() {
  const { subscription, loading, enabled } = useSubscription()
  if (!enabled || loading || !subscription) return null
  if (subscription.status === 'pending') {
    return <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Pagamento pendente. O acesso continua liberado enquanto o Mercado Pago confirma a cobrança.</p>
  }
  if (subscription.status === 'trial' && subscription.next_billing_date) {
    const remaining = Math.max(0, Math.ceil((new Date(subscription.next_billing_date).getTime() - Date.now()) / 86400000))
    return <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Seu período de avaliação termina em {remaining} {remaining === 1 ? 'dia' : 'dias'}.</p>
  }
  return null
}
