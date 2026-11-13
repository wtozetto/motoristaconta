import { useDrive } from '../drive/DriveContext'

export function DriveBadge() {
  const { status, message } = useDrive()
  const isSyncing = status === 'syncing' || status === 'connecting'
  const isMerged = status === 'ok' && Boolean(message?.includes('Mesclagem'))
  const isLocalUpdate = status === 'ok' && Boolean(message?.includes('dados locais estão'))
  const isRemoteUpdate = status === 'ok' && Boolean(message?.includes('versão mais recente do Google Drive'))

  const badge = isSyncing
    ? { icon: '⏳', label: 'Sincronizando', color: 'text-blue-600 dark:text-blue-400' }
    : status === 'error'
      ? { icon: '⚠️', label: 'Falha na sincronização', color: 'text-rose-600 dark:text-rose-400' }
      : isMerged
        ? { icon: '🔄', label: 'Dados mesclados', color: 'text-amber-600 dark:text-amber-400' }
        : isLocalUpdate
          ? { icon: '⬆️', label: 'Atualizado localmente', color: 'text-blue-600 dark:text-blue-400' }
          : isRemoteUpdate
            ? { icon: '⬇️', label: 'Atualizado pelo Drive', color: 'text-violet-600 dark:text-violet-400' }
            : status === 'dev'
              ? { icon: '✅', label: 'Modo de teste', color: 'text-slate-500' }
              : { icon: '✅', label: 'Ocioso · sincronizado', color: 'text-emerald-600 dark:text-emerald-400' }

  return (
    <p
      className={`flex items-center gap-1.5 text-[11px] font-medium leading-tight ${badge.color}`}
      role="status"
      title={message ?? undefined}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {status === 'error' && message ? message : badge.label}
    </p>
  )
}
