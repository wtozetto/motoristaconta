import { createHmac, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, serverClients } from './_shared/supabase.js'

function header(req: VercelRequest, name: string): string {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function validWebhookSignature(
  signature: string,
  requestId: string,
  dataId: string,
  secret: string,
): boolean {
  const ts = /(?:^|,)ts=([^,]+)/.exec(signature)?.[1]
  const supplied = /(?:^|,)v1=([^,]+)/.exec(signature)?.[1]
  if (!ts || !supplied || !requestId || !dataId) return false
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(supplied, 'hex')
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

async function mercadoPagoResource(accessToken: string, resource: string) {
  const response = await fetch(`https://api.mercadopago.com${resource}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Mercado Pago resource returned ${response.status}`)
  return response.json() as Promise<Record<string, unknown>>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(res, 405, 'Method not allowed')
  }
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!secret || !accessToken) return fail(res, 503, 'Payment webhook is not configured')

  const body = req.body as { type?: string; action?: string; data?: { id?: string } } | undefined
  const dataId = String(req.query['data.id'] ?? body?.data?.id ?? '')
  const eventType = String(req.query.type ?? body?.type ?? '')
  if (!/^[\w-]+$/.test(dataId)) return fail(res, 400, 'Invalid event resource')
  if (!validWebhookSignature(header(req, 'x-signature'), header(req, 'x-request-id'), dataId, secret)) {
    return fail(res, 401, 'Invalid webhook signature')
  }

  try {
    const clients = serverClients()
    if (eventType === 'payment' || body?.action?.startsWith('payment.')) {
      const payment = await mercadoPagoResource(accessToken, `/v1/payments/${encodeURIComponent(dataId)}`)
      const mpPaymentId = String(payment.id ?? dataId)
      const mpSubscriptionId = typeof payment.preapproval_id === 'string' ? payment.preapproval_id : null
      let subscriptionQuery = clients.admin.from('subscriptions')
        .select('id, user_id, plan_id, status, next_billing_date, plans(price, period_days)')
      if (mpSubscriptionId) {
        subscriptionQuery = subscriptionQuery.eq('mercadopago_subscription_id', mpSubscriptionId)
      } else {
        const externalId = typeof payment.external_reference === 'string' ? payment.external_reference : ''
        subscriptionQuery = subscriptionQuery.eq('id', externalId)
      }
      const { data: subscription, error: subError } = await subscriptionQuery.maybeSingle()
      if (subError) throw subError
      if (!subscription) return res.status(200).json({ success: true, ignored: true })

      const mappedStatus = payment.status === 'approved' ? 'paid'
        : payment.status === 'refunded' ? 'refunded'
        : payment.status === 'rejected' ? 'failed'
        : payment.status === 'cancelled' ? 'expired'
        : 'pending'
      const approvedAt = typeof payment.date_approved === 'string' ? payment.date_approved : null
      const { data: previous } = await clients.admin.from('payments')
        .select('status').eq('mercadopago_payment_id', mpPaymentId).maybeSingle()
      const { error: paymentError } = await clients.admin.from('payments').upsert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        amount: Number(payment.transaction_amount ?? subscription.plans?.[0]?.price ?? 0),
        status: mappedStatus,
        payment_date: approvedAt,
        due_date: typeof payment.date_of_expiration === 'string'
          ? payment.date_of_expiration
          : subscription.next_billing_date ?? new Date().toISOString(),
        mercadopago_payment_id: mpPaymentId,
        invoice_url: typeof payment.transaction_details === 'object'
          && payment.transaction_details !== null
          && 'external_resource_url' in payment.transaction_details
          ? String(payment.transaction_details.external_resource_url ?? '')
          : null,
      }, { onConflict: 'mercadopago_payment_id' })
      if (paymentError) throw paymentError

      if (mappedStatus === 'paid') {
        const nextBilling = typeof payment.date_of_next_payment === 'string'
          ? payment.date_of_next_payment
          : new Date(Date.now() + Number(subscription.plans?.[0]?.period_days ?? 30) * 86400000).toISOString()
        const { error } = await clients.admin.from('subscriptions')
          .update({ status: 'active', next_billing_date: nextBilling, updated_at: new Date().toISOString() })
          .eq('id', subscription.id)
        if (error) throw error
      }
      if (previous?.status !== mappedStatus) {
        const title = mappedStatus === 'paid' ? 'Pagamento confirmado' : 'Atualização do pagamento'
        const message = mappedStatus === 'paid'
          ? 'Sua assinatura foi renovada e o acesso está liberado.'
          : `O pagamento da assinatura está ${mappedStatus}.`
        const { error } = await clients.admin.from('notifications').insert({
          user_id: subscription.user_id, type: 'subscription_alert', title, message,
        })
        if (error) throw error
      }
      return res.status(200).json({ success: true })
    }

    if (eventType === 'subscription_preapproval' || eventType === 'preapproval'
      || body?.action?.startsWith('subscription_preapproval.')) {
      const preapproval = await mercadoPagoResource(accessToken, `/preapproval/${encodeURIComponent(dataId)}`)
      let { data: subscription, error } = await clients.admin
        .from('subscriptions')
        .select('id, user_id, status')
        .eq('mercadopago_subscription_id', dataId)
        .maybeSingle()
      if (error) throw error
      if (!subscription && typeof preapproval.external_reference === 'string') {
        const fallback = await clients.admin.from('subscriptions')
          .select('id, user_id, status')
          .eq('id', preapproval.external_reference)
          .maybeSingle()
        if (fallback.error) throw fallback.error
        subscription = fallback.data
      }
      if (!subscription) return res.status(200).json({ success: true, ignored: true })
      const mpStatus = preapproval.status === 'authorized' ? 'active'
        : preapproval.status === 'cancelled' ? 'canceled'
        : 'pending'
      const { error: updateError } = await clients.admin.from('subscriptions').update({
        status: mpStatus,
        next_billing_date: typeof preapproval.next_payment_date === 'string'
          ? preapproval.next_payment_date
          : undefined,
        canceled_at: mpStatus === 'canceled' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', subscription.id)
      if (updateError) throw updateError
      if (mpStatus === 'active' && subscription.status !== 'active') {
        const { error: notificationError } = await clients.admin.from('notifications').insert({
          user_id: subscription.user_id,
          type: 'subscription_alert',
          title: 'Assinatura confirmada',
          message: 'Sua assinatura foi confirmada e o acesso está liberado.',
        })
        if (notificationError) throw notificationError
      }
      return res.status(200).json({ success: true })
    }

    return res.status(200).json({ success: true, ignored: true })
  } catch (error) {
    console.error('Mercado Pago webhook processing failed:', error)
    return fail(res, 500, 'Webhook processing failed')
  }
}
