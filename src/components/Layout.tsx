import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useDrive } from '../drive/DriveContext'
import { DriveBadge } from './DriveBadge'
import { useSyncTimer } from '../hooks/useSyncTimer'
import { Toast } from './Toast'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { NotificationsBell } from './NotificationsBell'
import { SubscriptionNotice } from './SubscriptionNotice'

const LINKS = [
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/manutencao', label: 'Manutenção' },
  { to: '/categorias', label: 'Categorias' },
  { to: '/lembretes', label: 'Lembretes' },
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
                  ? 'app-nav-active'
                  : 'app-nav-idle'
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { session, logout } = useAuth()
  const { isInitialSyncing, message, status, syncNow } = useDrive()
  const navigate = useNavigate()
  useKeyboardShortcuts(navigate, syncNow)
  useSyncTimer()

  if (isInitialSyncing) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
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
    <div className="app-shell min-h-dvh">
      <aside className="app-sidebar hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:p-5">
        <div className="flex items-center gap-3 border-b border-amber-400/30 pb-5">
          <img src="/icon-192.png" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-lg font-bold tracking-tight">MotoristaConta</p>
            <p className="sidebar-subtle text-xs">ContaRota</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-2" aria-label="Principal">
          <NavItems />
          {session?.role === 'admin' ? (
            <NavLink to="/admin" className="app-nav-idle rounded-xl px-3 py-2 text-sm font-medium">
              Painel administrativo
            </NavLink>
          ) : null}
        </nav>
        <NavLink
          to="/atalhos"
          className="app-nav-idle mt-3 rounded-xl px-3 py-2 text-sm font-medium"
        >
          Ajuda e atalhos
        </NavLink>
        <div className="sidebar-separator mt-auto space-y-3 border-t pt-4">
          <p className="text-sm font-medium">{session?.name}</p>
          <p className="sidebar-subtle truncate text-xs">{session?.email}</p>
          <DriveBadge />
          <NotificationsBell />
          <button
            type="button"
            onClick={logout}
            className="btn-secondary h-10 w-full rounded-xl text-sm font-medium text-white hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-amber-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-amber-900/40 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <img src="/icon-192.png" alt="" className="h-8 w-8 object-contain" />
            <div>
              <p className="font-bold">MotoristaConta</p>
              <p className="text-xs text-slate-500">{session?.name}</p>
              <DriveBadge />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/atalhos" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Ajuda
            </NavLink>
            {session?.role === 'admin' ? <NavLink to="/admin" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Admin</NavLink> : null}
            <button
              type="button"
              onClick={logout}
              className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="px-4 py-5 pb-24 lg:px-8 lg:pb-8">
          <SubscriptionNotice />
          <Outlet />
        </main>
      </div>

      <nav
        className="app-mobile-nav fixed inset-x-0 bottom-0 z-20 border-t border-amber-200 bg-white/95 p-2 backdrop-blur lg:hidden dark:border-amber-900/40 dark:bg-slate-900/95"
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-lg gap-1">
          <NavItems />
        </div>
      </nav>
      <Toast message={message} status={status} />
    </div>
  )
}
