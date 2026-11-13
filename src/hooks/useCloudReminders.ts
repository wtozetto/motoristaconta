import { useCallback, useEffect, useState } from 'react'
import type { DriverReminder, ReminderType } from '../types/admin'
import { supabase } from '../services/supabase'
import { useAuth } from '../auth/AuthContext'

export function useCloudReminders() {
  const { session } = useAuth()
  const [reminders, setReminders] = useState<DriverReminder[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !session?.supabaseUserId) return
    const { data, error: queryError } = await supabase.from('reminders')
      .select('id, user_id, type, title, description, due_date, repeat_days, notify_days_before, is_active')
      .eq('user_id', session.supabaseUserId)
      .order('due_date', { ascending: true })
    if (queryError) setError(queryError.message)
    else {
      setReminders(data ?? [])
      setError(null)
    }
  }, [session?.supabaseUserId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(async (input: {
    type: ReminderType
    title: string
    description: string
    due_date: string
    repeat_days: number | null
    notify_days_before: number
  }) => {
    if (!supabase || !session?.supabaseUserId) throw new Error('Lembretes na nuvem indisponíveis.')
    const { error: saveError } = await supabase.from('reminders').insert({
      ...input,
      user_id: session.supabaseUserId,
      due_date: new Date(`${input.due_date}T12:00:00`).toISOString(),
    })
    if (saveError) throw saveError
    await refresh()
  }, [refresh, session?.supabaseUserId])

  const remove = useCallback(async (id: string) => {
    if (!supabase || !session?.supabaseUserId) throw new Error('Lembretes na nuvem indisponíveis.')
    const { error: deleteError } = await supabase.from('reminders').delete()
      .eq('id', id).eq('user_id', session.supabaseUserId)
    if (deleteError) throw deleteError
    await refresh()
  }, [refresh, session?.supabaseUserId])

  return { reminders, error, save, remove, refresh }
}
