import { useCallback, useEffect, useState } from 'react'
import type { Subscription } from '../types/admin'
import { getAccessToken, supabase } from '../services/supabase'
import { useAuth } from '../auth/AuthContext'

export function useSubscription() {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [accountBlocked, setAccountBlocked] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase || !session?.supabaseUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [{ data, error: queryError }, maintenanceResponse] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, user_id, plan_id, status, start_date, next_billing_date, canceled_at, plans(name, price)')
          .eq('user_id', session.supabaseUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        (async () => {
        const token = await getAccessToken()
        const response = await fetch('/api/check-subscription', { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('Não foi possível verificar o status do sistema.')
        return response.json() as Promise<{ maintenanceMode?: boolean; accountBlocked?: boolean }>
        })(),
      ])
      if (queryError) {
        setError(queryError.message)
        setSubscription(null)
      } else {
        setError(null)
        setSubscription(data as Subscription | null)
        setMaintenanceMode(maintenanceResponse.maintenanceMode === true)
        setAccountBlocked(maintenanceResponse.accountBlocked === true)
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Falha ao verificar assinatura.')
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [session?.supabaseUserId])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  return { subscription, loading, error, refresh, enabled: Boolean(supabase), maintenanceMode, accountBlocked }
}
