import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, fail, serverClients } from './_shared/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return fail(res, 405, 'Method not allowed')
  }
  try {
    const clients = serverClients()
    const user = await authenticatedUser(req, clients)
    if (!user) return fail(res, 401, 'Authentication required')
    const { data, error } = await clients.admin
      .from('subscriptions')
      .select('id, status, next_billing_date, plan_id, plans(name, price)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    const [{ data: settings, error: settingsError }, { data: profile, error: profileError }] = await Promise.all([
      clients.admin.from('system_settings').select('value').eq('key', 'billing_settings').maybeSingle(),
      clients.admin.from('profiles').select('access_blocked').eq('id', user.id).maybeSingle(),
    ])
    if (settingsError || profileError) throw settingsError ?? profileError
    const billingSettings = settings?.value as { maintenance_mode?: boolean } | undefined
    return res.status(200).json({
      success: true,
      subscription: data?.[0] ?? null,
      maintenanceMode: billingSettings?.maintenance_mode === true,
      accountBlocked: profile?.access_blocked === true,
    })
  } catch (error) {
    console.error('Failed to check subscription:', error)
    return fail(res, 500, 'Não foi possível consultar a assinatura.')
  }
}
