import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, fail, isAdmin, serverClients } from './_shared/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return fail(res, 405, 'Method not allowed')
  }
  try {
    const clients = serverClients()
    const user = await authenticatedUser(req, clients)
    if (!user) return fail(res, 401, 'Authentication required')
    if (!await isAdmin(user.id, clients.admin)) return fail(res, 403, 'Admin access required')

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    const targetUserId = typeof req.body?.userId === 'string' ? req.body.userId : null
    if (!title || title.length > 120 || !message || message.length > 2000) {
      return fail(res, 400, 'Título ou mensagem inválidos.')
    }
    let userIds: string[]
    if (targetUserId) {
      userIds = [targetUserId]
    } else {
      const { data, error } = await clients.admin.from('profiles').select('id')
      if (error) throw error
      userIds = (data ?? []).map((profile: { id: string }) => profile.id)
    }
    if (userIds.length === 0) return res.status(200).json({ success: true, sent: 0 })
    const rows = userIds.map((user_id) => ({
      user_id, type: 'administrative', title, message,
    }))
    const { error } = await clients.admin.from('notifications').insert(rows)
    if (error) throw error
    return res.status(200).json({ success: true, sent: rows.length })
  } catch (error) {
    console.error('Failed to send notification:', error)
    return fail(res, 500, 'Não foi possível enviar a notificação.')
  }
}
