import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, serverClients } from './_shared/supabase.js'

function authorized(req: VercelRequest): boolean {
  const configured = process.env.CRON_SECRET
  const supplied = req.headers.authorization?.replace(/^Bearer /, '')
  if (!configured || !supplied) return false
  const expectedBuffer = Buffer.from(configured)
  const suppliedBuffer = Buffer.from(supplied)
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return fail(res, 405, 'Method not allowed')
  }
  if (!authorized(req)) return fail(res, 401, 'Unauthorized')
  try {
    const admin = serverClients().admin
    const { data: billingConfig, error: settingsError } = await admin.from('system_settings')
      .select('value').eq('key', 'billing_settings').maybeSingle()
    if (settingsError) throw settingsError
    const config = billingConfig?.value as {
      grace_period_days?: number
      messages?: Record<string, string>
      email_from?: string
    } | undefined
    const graceDays = Number.isInteger(config?.grace_period_days)
      && Number(config?.grace_period_days) >= 1
      && Number(config?.grace_period_days) <= 30
      ? Number(config?.grace_period_days)
      : 7
    const today = new Date()
    const todayDate = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    const subscriptionWindowStart = new Date(todayDate - 31 * 86400000).toISOString()
    const subscriptionWindowEnd = new Date(todayDate + 8 * 86400000).toISOString()
    const { data: subscriptions, error } = await admin.from('subscriptions')
      .select('id, user_id, next_billing_date, profiles(email), plans(price)')
      .in('status', ['active', 'suspended'])
      .gte('next_billing_date', subscriptionWindowStart)
      .lte('next_billing_date', subscriptionWindowEnd)
      .not('next_billing_date', 'is', null)
    if (error) throw error
    let notificationsSent = 0
    for (const subscription of subscriptions ?? []) {
      if (Number(subscription.plans?.[0]?.price ?? 0) <= 0) continue
      if (!subscription.next_billing_date) continue
      const due = new Date(subscription.next_billing_date)
      const dueDate = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
      const daysUntil = Math.round((dueDate - todayDate) / 86400000)
      const alert = daysUntil === 7 ? ['7d_before', 'Sua assinatura vence em 7 dias.']
        : daysUntil === 3 ? ['3d_before', 'Faltam 3 dias para o vencimento da sua assinatura.']
        : daysUntil === 0 ? ['due_day', 'Sua assinatura vence hoje. Renove para manter o acesso.']
        : daysUntil === -graceDays ? ['blocked', config?.messages?.blocked ?? 'Sua assinatura foi suspensa por falta de pagamento.']
        : daysUntil === -3 ? ['3d_late', 'Pagamento pendente: o acesso será suspenso em 4 dias.']
        : null
      if (!alert) continue

      const [alertType, message] = alert
      const configuredMessage = config?.messages?.[alertType]
      const finalMessage = (configuredMessage ?? message)
        .replaceAll('{days}', String(Math.max(0, graceDays - 3)))
      const billingDate = due.toISOString().slice(0, 10)
      const { data: inserted, error: alertError } = await admin.from('billing_alerts').insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        alert_type: alertType,
        billing_date: billingDate,
        channel: 'in_app',
      }).select('id').maybeSingle()
      if (alertError?.code === '23505') continue
      if (alertError) throw alertError
      if (!inserted) continue

      if (alertType === 'blocked') {
        const { error: suspendError } = await admin.from('subscriptions')
          .update({ status: 'suspended', updated_at: new Date().toISOString() })
          .eq('id', subscription.id)
        if (suspendError) throw suspendError
      }
      const { error: notificationError } = await admin.from('notifications').insert({
        user_id: subscription.user_id,
        type: 'payment_reminder',
        title: alertType === 'blocked' ? 'Assinatura suspensa' : 'Lembrete de pagamento',
        message: finalMessage,
      })
      if (notificationError) throw notificationError
      const emailFrom = config?.email_from || process.env.EMAIL_FROM
      if (alertType === 'due_day' && process.env.RESEND_API_KEY && emailFrom) {
        const profile = Array.isArray(subscription.profiles) ? subscription.profiles[0] : subscription.profiles
        const email = profile?.email
        if (email) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [email],
              subject: 'Vencimento da assinatura MotoristaConta',
              text: finalMessage,
            }),
          })
          if (response.ok) {
            const { error: channelError } = await admin.from('billing_alerts')
              .update({ channel: 'both' })
              .eq('subscription_id', subscription.id)
              .eq('billing_date', billingDate)
              .eq('alert_type', alertType)
            if (channelError) throw channelError
          } else {
            console.error('Billing reminder email failed:', response.status)
          }
        }
      }
      notificationsSent += 1
    }

    const reminderWindowStart = new Date(todayDate - 366 * 86400000).toISOString()
    const reminderWindowEnd = new Date(todayDate + 366 * 86400000).toISOString()
    const { data: reminders, error: remindersError } = await admin.from('reminders')
      .select('id, user_id, title, due_date, repeat_days, notify_days_before')
      .eq('is_active', true)
      .gte('due_date', reminderWindowStart)
      .lte('due_date', reminderWindowEnd)
    if (remindersError) throw remindersError
    for (const reminder of reminders ?? []) {
      const due = new Date(reminder.due_date)
      const dueDate = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate())
      const daysUntil = Math.round((dueDate - todayDate) / 86400000)
      if (daysUntil > Number(reminder.notify_days_before)) continue
      const billingDate = due.toISOString().slice(0, 10)
      const { data: inserted, error: alertError } = await admin.from('reminder_alerts').insert({
        reminder_id: reminder.id,
        user_id: reminder.user_id,
        due_date: billingDate,
      }).select('id').maybeSingle()
      if (alertError?.code === '23505') continue
      if (alertError) throw alertError
      if (!inserted) continue

      const title = daysUntil <= 0 ? `Vence hoje ou está atrasado: ${reminder.title}` : `Lembrete próximo: ${reminder.title}`
      const message = daysUntil <= 0
        ? `O lembrete "${reminder.title}" venceu.`
        : `O lembrete "${reminder.title}" vence em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}.`
      const { error: notificationError } = await admin.from('notifications').insert({
        user_id: reminder.user_id,
        type: 'maintenance',
        title,
        message,
      })
      if (notificationError) throw notificationError
      notificationsSent += 1

      const repeatDays = Number(reminder.repeat_days ?? 0)
      if (repeatDays > 0 && daysUntil <= 0) {
        const periods = Math.floor((todayDate - dueDate) / (repeatDays * 86400000)) + 1
        const nextDue = new Date(due.getTime() + periods * repeatDays * 86400000).toISOString()
        const { error: repeatError } = await admin.from('reminders')
          .update({ due_date: nextDue })
          .eq('id', reminder.id)
        if (repeatError) throw repeatError
      }
    }
    return res.status(200).json({ success: true, notificationsSent })
  } catch (error) {
    console.error('Billing reminder job failed:', error)
    return fail(res, 500, 'Billing reminder job failed')
  }
}
