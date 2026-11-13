import { NavLink, Outlet } from 'react-router-dom'

const LINKS = [
  ['/admin', 'Visão geral'],
  ['/admin/usuarios', 'Usuários'],
  ['/admin/assinaturas', 'Assinaturas'],
  ['/admin/pagamentos', 'Pagamentos'],
  ['/admin/lembretes', 'Lembretes'],
  ['/admin/configuracoes', 'Configurações'],
] as const

export function AdminLayout() {
  return (
    <div className="min-h-dvh bg-[#FAF8F0] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-8">
        <h1 className="font-bold text-emerald-800 dark:text-emerald-400">MotoristaConta · Admin</h1>
        <NavLink to="/dashboard" className="rounded-lg border px-3 py-2 text-sm">Voltar ao aplicativo</NavLink>
      </header>
      <div className="mx-auto max-w-7xl p-4 sm:p-8">
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label="Administração">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) =>
              `whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${isActive ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`
            }>{label}</NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  )
}
