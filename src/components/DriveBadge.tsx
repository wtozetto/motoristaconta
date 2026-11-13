import { useDrive } from '../drive/DriveContext'

export function DriveBadge() {
  const { status, message } = useDrive()
  const isSyncing = status === 'syncing' || status === 'connecting'
  const isMerged = status === 'ok' && Boolean(message?.includes('Mesclagem'))
  const isLocalUpdate = status === 'ok' && Boolean(message?.includes('dados locais estão'))
  const isRemoteUpdate = status === 'ok' && Boolean(message?.includes('versão mais recente do Google Drive'))

  const badge = isSyncing
    ? { icon: '🔄', label: 'Sincronizando', color: 'text-dourado glow-dourado' }
    : status === 'error'
      ? { icon: '⚠️', label: 'Falha na sincronização', color: 'text-rose-600 dark:text-rose-400' }
      : isMerged
        ? { icon: '🔄', label: 'Dados mesclados', color: 'text-dourado' }
        : isLocalUpdate
          ? { icon: '⬆️', label: 'Atualizado localmente', color: 'text-blue-600 dark:text-blue-400' }
          : isRemoteUpdate
            ? { icon: '⬇️', label: 'Atualizado pelo Drive', color: 'text-violet-600 dark:text-violet-400' }
            : status === 'dev'
              ? { icon: '✅', label: 'Modo de teste', color: 'text-slate-500' }
              : status === 'offline'
                ? { icon: '☁️', label: 'Sem conexão', color: 'text-dourado' }
                : { icon: '✓', label: 'Sincronizado', color: 'text-verde' }

  return (
    <div className="space-y-1">
      <p
        className={`flex items-center gap-1.5 text-[11px] font-medium leading-tight ${badge.color}`}
        role="status"
        title={message ?? undefined}
      >
        <span aria-hidden="true">{badge.icon}</span>
        {status === 'error' && message ? message : badge.label}
      </p>
      {isSyncing ? (
        <div
          role="progressbar"
          aria-label="Sincronização em andamento"
          aria-valuetext="Em andamento"
          className="h-1 overflow-hidden rounded-full bg-dourado-suave"
        >
          <div className="progress-bar h-full w-2/5 animate-pulse" />
        </div>
      ) : null}
    </div>
  )
}
