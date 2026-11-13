import { useEffect, useState } from 'react'
import type { DriveStatus } from '../drive/DriveContext'

interface ToastProps {
  message: string | null
  status: DriveStatus
}

export function Toast({ message, status }: ToastProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const key = message ? `${status}:${message}` : null

  useEffect(() => {
    if (!key) return
    const timer = window.setTimeout(() => setDismissedKey(key), 5000)
    return () => window.clearTimeout(timer)
  }, [key])

  if (!message || !key || dismissedKey === key) return null

  const style =
    status === 'error'
      ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100'
      : status === 'syncing' || status === 'connecting'
        ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'

  return (
    <div
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-20 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border p-4 text-sm shadow-lg sm:bottom-4 ${style}`}
    >
      <span aria-hidden="true" className="text-base">
        {status === 'error' ? '⚠️' : status === 'syncing' || status === 'connecting' ? '🔄' : '✓'}
      </span>
      <p className="flex-1">{message}</p>
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={() => setDismissedKey(key)}
        className="font-bold opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}
