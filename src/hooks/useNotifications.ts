import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../auth/AuthContext'

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export function useNotifications() {
  const { session } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !session?.supabaseUserId) return
    const { data, error: queryError } = await supabase.from('notifications')
      .select('id, type, title, message, read, created_at')
      .eq('user_id', session.supabaseUserId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (queryError) setError(queryError.message)
    else {
      setError(null)
      setNotifications(data ?? [])
    }
  }, [session?.supabaseUserId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const markRead = useCallback(async (id?: string) => {
    if (!supabase || !session?.supabaseUserId) return
    const query = supabase.from('notifications').update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', session.supabaseUserId).eq('read', false)
    const { error: updateError } = id ? await query.eq('id', id) : await query
    if (updateError) setError(updateError.message)
    else await refresh()
  }, [refresh, session?.supabaseUserId])

  return { notifications, unreadCount: notifications.filter((item) => !item.read).length, error, refresh, markRead }
}
