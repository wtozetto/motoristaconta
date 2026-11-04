import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useDrive } from '../drive/DriveContext'

const LINKS = [
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/manutencao', label: 'Manutenção' },
  { to: '/configuracoes', label: 'Configurações' },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-xs font-semibold sm:flex-none sm:flex-row sm:gap-2 sm:text-sm ${
              isActive
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Sincronizando"
    />
  )
}

function badgeColor(status: string, message: string | null): string {
  if (status === 'error') return 'text-rose-600 dark:text-rose-400'
  if (status === 'syncing' || status === 'connecting') return 'text-blue-600 dark:text-blue-400'
  if (status === 'ok' && message?.includes('Mesclagem')) return 'text-amber-600 dark:text-amber-400'
  if (status === 'ok') return 'text-emerald-600 dark:text-emerald-400'
  return 'text-slate-500'
}

function DriveBadge() {
  const { status, message } = useDrive()

  const isBusy = status === 'syncing' || status === 'connecting'

  const label = isBusy
    ? 'Sincronizando Drive…'
    : status === 'ok' && message
      ? message
      : status === 'ok'
        ? 'Drive sincronizado'
        : status === 'error'
          ? message || 'Drive desconectado'
          : status === 'dev'
            ? 'Drive (modo teste)'
            : 'Drive'

  return (
    <p
      className={`flex items-center gap-1.5 text-[11px] font-medium leading-tight transition-colors ${badgeColor(status, message)}`}
      title={message ?? undefined}
    >
      {isBusy ? <Spinner /> : null}
      {label}
    </p>
  )
}

export function Layout() {
  const { session, logout } = useAuth()
  const { isInitialSyncing } = useDrive()

  if (isInitialSyncing) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center dark:bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          Sincronizando com o Google Drive…
        </h2>
        <p className="max-w-sm text-xs text-slate-500">
          Comparando a versão mais recente entre seu aparelho e a nuvem antes de carregar seus dados.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:p-5 dark:lg:border-slate-800 dark:lg:bg-slate-900">
        <p className="text-lg font-bold tracking-tight">MotoristaConta</p>
        <p className="text-xs text-slate-500">ContaRota</p>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Principal">
          <NavItems />
        </nav>
        <div className="mt-auto space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-sm font-medium">{session?.name}</p>
          <p className="truncate text-xs text-slate-500">{session?.email}</p>
          <DriveBadge />
          <button
            type="button"
            onClick={logout}
            className="h-10 w-full rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <p className="font-bold">MotoristaConta</p>
            <p className="text-xs text-slate-500">{session?.name}</p>
            <DriveBadge />
          </div>
          <button
            type="button"
            onClick={logout}
            className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sair
          </button>
        </header>
        <main className="px-4 py-5 pb-24 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-2 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-lg gap-1">
          <NavItems />
        </div>
      </nav>
    </div>
  )
}
