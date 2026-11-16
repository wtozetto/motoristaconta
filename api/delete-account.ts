import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, fail, serverClients } from './_shared/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE')
    return fail(res, 405, 'Method not allowed')
  }

  try {
    const clients = serverClients()
    const user = await authenticatedUser(req, clients)
    if (!user) return fail(res, 401, 'Authentication required')

    const { error } = await clients.admin.auth.admin.deleteUser(user.id)
    if (error) throw error

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Failed to delete account:', error)
    return fail(res, 500, 'Não foi possível excluir a conta.')
  }
}
