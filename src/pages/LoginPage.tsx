import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'
import { GoogleSignIn } from '../components/GoogleSignIn'

const COUNT_INTERVAL = 5 * 60 * 1000

export function LoginPage() {
  const { session } = useAuth()
  const [userCount, setUserCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const fetchCount = async () => {
      try {
        const response = await fetch('/api/get-user-count')
        if (!response.ok) throw new Error(`Counter request failed: ${response.status}`)

        const data: unknown = await response.json()
        if (
          typeof data !== 'object'
          || data === null
          || !('success' in data)
          || data.success !== true
          || !('total' in data)
          || typeof data.total !== 'number'
          || !Number.isSafeInteger(data.total)
          || data.total < 0
        ) {
          throw new Error('Invalid counter response')
        }

        if (active) setUserCount(data.total)
      } catch (error) {
        console.error('Falha ao buscar contador de usuários:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void fetchCount()
    const timer = window.setInterval(() => void fetchCount(), COUNT_INTERVAL)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

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
        <div
          className="mt-6 min-h-[2rem] border-t border-[rgba(212,175,55,0.15)] pt-4 text-center"
          aria-live="polite"
        >
          {!loading && userCount !== null ? (
            <p className="text-sm text-[#5F7468]">
              Já com outros{' '}
              <span className="font-semibold text-[#D4AF37]">
                {userCount.toLocaleString('pt-BR')}
              </span>{' '}
              motoristas cadastrados
            </p>
          ) : loading ? (
            <span className="text-sm text-[#5F7468]/60">Carregando...</span>
          ) : null}
        </div>
        <p className="mt-6 text-xs leading-5 text-[#5F7468]">
          O login pede acesso ao Drive só para arquivos criados por este app
          (MotoristaConta-dados.json e MotoristaConta-acessos.json).
        </p>
      </main>
    </div>
  )
}
