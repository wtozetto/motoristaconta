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
    <div className="login-page flex min-h-dvh items-center justify-center px-4 py-8">
      <main className="login-card w-full max-w-md rounded-2xl p-6 sm:p-8">
        <div className="mb-6 text-center">
          <img
            src="/icon-192.png"
            alt=""
            className="login-logo mx-auto mb-3 h-16 w-16 object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[#0C5C38]">MotoristaConta</h1>
          <p className="mt-1 text-sm text-[#5F7468]">
            Controle de gastos, ganhos e rotas para motoristas.
          </p>
        </div>
        <ul className="mb-6 space-y-2 text-sm text-[#5F7468]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#806000]" aria-hidden="true">•</span>
            <span>Controle de gastos, ganhos e rotas em tempo real.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#806000]" aria-hidden="true">•</span>
            <span>Login seguro com Google.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-[#806000]" aria-hidden="true">•</span>
            <span>Backup automático dos seus dados.</span>
          </li>
        </ul>
        <div>
          <GoogleSignIn />
        </div>
        <p className="mt-6 text-xs leading-5 text-[#5F7468]">
          O login pede acesso ao Drive só para arquivos criados por este app
          (MotoristaConta-dados.json e MotoristaConta-acessos.json).
        </p>
      </main>
    </div>
  )
}
