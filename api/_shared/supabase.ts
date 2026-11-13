import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export function serverClients() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Supabase server environment is not configured.')
  }
  return {
    auth: createClient(url, anonKey, { auth: { persistSession: false } }),
    admin: createClient(url, serviceRoleKey, { auth: { persistSession: false } }),
  }
}

export async function authenticatedUser(
  req: VercelRequest,
  clients = serverClients(),
): Promise<User | null> {
  const authorization = req.headers.authorization
  const match = typeof authorization === 'string' ? /^Bearer ([^\s]+)$/.exec(authorization) : null
  if (!match) return null
  const { data, error } = await clients.auth.auth.getUser(match[1])
  if (error) return null
  return data.user
}

export async function isAdmin(userId: string, admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.role === 'admin'
}

export function fail(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ success: false, error: message })
}
