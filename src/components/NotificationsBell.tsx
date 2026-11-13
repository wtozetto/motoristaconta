import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, error, markRead } = useNotifications()
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg px-2 py-2 text-sm"
      >
        🔔{unreadCount > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{unreadCount}</span> : null}
      </button>
      {open ? (
        <section className="absolute right-0 z-30 mt-2 max-h-96 w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Notificações</h2>
            <button type="button" onClick={() => void markRead()} className="text-xs text-emerald-700">Marcar todas como lidas</button>
          </div>
          {error ? <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p> : null}
          {notifications.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => { if (!item.read) void markRead(item.id) }}
              className={`mt-2 block w-full rounded-xl p-3 text-left text-sm ${item.read ? 'bg-slate-50 dark:bg-slate-800' : 'bg-emerald-50 dark:bg-emerald-950/40'}`}
            >
              <span className="font-semibold">{item.title}</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{item.message}</span>
            </button>
          ))}
          {!notifications.length && !error ? <p className="py-5 text-center text-sm text-slate-500">Nenhuma notificação.</p> : null}
        </section>
      ) : null}
    </div>
  )
}
