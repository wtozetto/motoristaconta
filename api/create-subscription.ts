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
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : ''
    const { data: plan, error: planError } = await clients.admin
      .from('plans').select('id, name, price, period_days')
      .eq('id', planId).eq('is_active', true).single()
    if (planError || !plan) return fail(res, 404, 'Plano não encontrado ou inativo.')
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    const appUrl = process.env.APP_URL
    if (Number(plan.price) > 0 && (!accessToken || !appUrl)) {
      return fail(res, 503, 'Mercado Pago não está configurado no servidor.')
    }
    const { data: profile, error: profileError } = await clients.admin
      .from('profiles').select('email, access_blocked').eq('id', user.id).single()
    if (profileError || !profile) return fail(res, 400, 'O perfil não existe.')
    if (profile.access_blocked) return fail(res, 403, 'A conta está bloqueada. Entre em contato com o suporte.')
    const payerEmail = Number(plan.price) > 0 ? profile.email : undefined
    if (Number(plan.price) > 0 && !payerEmail) return fail(res, 400, 'O perfil não possui e-mail válido.')
    const { data: subscriptionId, error: startError } = await clients.admin.rpc('start_subscription', {
      p_user_id: user.id,
      p_plan_id: plan.id,
    })
    if (startError?.code === '23505') return fail(res, 409, startError.message)
    if (startError?.code === '42501') return fail(res, 403, 'A conta está bloqueada. Entre em contato com o suporte.')
    if (startError) throw startError
    if (typeof subscriptionId !== 'string') throw new Error('Subscription creation returned an invalid id.')
    if (Number(plan.price) <= 0) {
      return res.status(200).json({ success: true, checkoutUrl: null })
    }
    if (!accessToken || !appUrl || !payerEmail) {
      throw new Error('Payment credentials or payer email are unavailable.')
    }

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': subscriptionId,
      },
      body: JSON.stringify({
        reason: `MotoristaConta - ${plan.name}`,
        external_reference: subscriptionId,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: Number(plan.period_days),
          frequency_type: 'days',
          transaction_amount: Number(plan.price),
          currency_id: 'BRL',
        },
        back_url: `${appUrl.replace(/\/$/, '')}/assinatura`,
        status: 'pending',
      }),
    })
    const checkout = await response.json() as { id?: string; init_point?: string; message?: string }
    if (!response.ok || !checkout.id || !checkout.init_point) {
      const { error: deleteError } = await clients.admin.from('subscriptions').delete().eq('id', subscriptionId)
      if (deleteError) throw deleteError
      const { error: restoreError } = await clients.admin.rpc('start_subscription', {
        p_user_id: user.id,
        p_plan_id: 'free',
      })
      if (restoreError) console.error('Could not restore a free subscription after checkout failure:', restoreError)
      console.error('Mercado Pago subscription creation failed:', checkout.message ?? response.status)
      return fail(res, 502, 'Não foi possível iniciar o pagamento. Tente novamente.')
    }

    const { error: updateError } = await clients.admin
      .from('subscriptions')
      .update({ mercadopago_subscription_id: checkout.id })
      .eq('id', subscriptionId)
    if (updateError) throw updateError
    return res.status(200).json({ success: true, checkoutUrl: checkout.init_point })
  } catch (error) {
    console.error('Failed to create subscription:', error)
    return fail(res, 500, 'Não foi possível criar a assinatura.')
  }
}
