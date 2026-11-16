import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Contador indisponível: variáveis do Supabase não configuradas')
    return res.status(500).json({ success: false, error: 'Counter unavailable' })
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase.rpc('get_total_users')

    if (error) throw error

    return res.status(200).json({ success: true, total: data ?? 0 })
  } catch (error) {
    console.error('Erro ao buscar contador:', error)
    return res.status(500).json({ success: false, error: 'Counter unavailable' })
  }
}
