import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'
import { GoogleSignIn } from '../components/GoogleSignIn'

export function LoginPage() {
  const { session } = useAuth()
  if (isAuthenticated(session)) {
    return <Navigate to="/lancamentos" replace />
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <main className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          ContaRota
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">MotoristaConta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Controle ganhos, km e lucro dos apps Uber, 99 e Indrive. Os lançamentos ficam neste
          aparelho e um backup automático vai para o seu Google Drive.
        </p>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>Lançamentos diários com totais ao vivo</li>
          <li>Dashboard por período e aplicativo</li>
          <li>Backup automático no Google Drive da sua conta</li>
        </ul>
        <div className="mt-8">
          <GoogleSignIn />
        </div>
        <p className="mt-6 text-xs text-slate-500">
          O login pede acesso ao Drive só para arquivos criados por este app
          (MotoristaConta-dados.json e MotoristaConta-acessos.json).
        </p>
      </main>
    </div>
  )
}
