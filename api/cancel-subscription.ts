import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, fail, serverClients } from './_shared/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(res, 405, 'Method not allowed')
  }

  try {
    const clients = serverClients()
    const user = await authenticatedUser(req, clients)
    if (!user) return fail(res, 401, 'Authentication required')
    const { data: subscription, error: queryError } = await clients.admin
      .from('subscriptions')
      .select('id, plan_id, status, next_billing_date, canceled_at, mercadopago_subscription_id, plans(price)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (queryError) throw queryError
    if (!subscription) return fail(res, 404, 'Assinatura não encontrada.')

    const billingDate = subscription.next_billing_date
      ? new Date(subscription.next_billing_date)
      : null
    if (!billingDate || !Number.isFinite(billingDate.getTime()) || billingDate.getTime() <= Date.now()) {
      return fail(res, 409, 'Não há um período pago futuro para cancelar.')
    }
    if (subscription.status === 'active' && subscription.canceled_at) {
      return res.status(200).json({ success: true, cancelAt: billingDate.toISOString() })
    }
    if (subscription.status !== 'active' || Number(subscription.plans?.[0]?.price ?? 0) <= 0) {
      return fail(res, 409, 'Esta assinatura não pode ser cancelada pelo aplicativo.')
    }
    if (!subscription.mercadopago_subscription_id) {
      return fail(res, 409, 'Não foi encontrada uma recorrência do Mercado Pago para cancelar.')
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) return fail(res, 503, 'Mercado Pago não está configurado no servidor.')

    const requestedAt = new Date().toISOString()
    const { data: updated, error: updateError } = await clients.admin
      .from('subscriptions')
      .update({ canceled_at: requestedAt, updated_at: requestedAt })
      .eq('id', subscription.id)
      .eq('status', 'active')
      .is('canceled_at', null)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return fail(res, 409, 'A assinatura foi atualizada. Recarregue a página e tente novamente.')

    const response = await fetch(
      `https://api.mercadopago.com/preapproval/${encodeURIComponent(subscription.mercadopago_subscription_id)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      },
    )
    if (!response.ok) {
      const { error: restoreError } = await clients.admin
        .from('subscriptions')
        .update({ canceled_at: null, updated_at: new Date().toISOString() })
        .eq('id', subscription.id)
        .eq('canceled_at', requestedAt)
      if (restoreError) throw restoreError
      return fail(res, 502, 'Não foi possível cancelar a recorrência. Tente novamente.')
    }

    return res.status(200).json({ success: true, cancelAt: billingDate.toISOString() })
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
    return fail(res, 500, 'Não foi possível cancelar a assinatura.')
  }
}
