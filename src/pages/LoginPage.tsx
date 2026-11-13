import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'
import { GoogleSignIn } from '../components/GoogleSignIn'

const USER_COUNT_KEY = 'mc_userCount'
const LAST_UPDATED_KEY = 'mc_countLastUpdated'
const INITIAL_COUNT = 1247
const COUNT_INTERVAL = 30 * 60 * 1000

function getUserCountState(now = Date.now()) {
  const storedCount = Number.parseInt(localStorage.getItem(USER_COUNT_KEY) ?? '', 10)
  const storedTimestamp = Number.parseInt(localStorage.getItem(LAST_UPDATED_KEY) ?? '', 10)
  const count = Number.isFinite(storedCount) && storedCount >= 0 ? storedCount : INITIAL_COUNT
  const lastUpdated = Number.isFinite(storedTimestamp) && storedTimestamp > 0
    ? storedTimestamp
    : now
  const increments = Math.floor(Math.max(0, now - lastUpdated) / COUNT_INTERVAL)

  return {
    count: count + increments,
    lastUpdated: lastUpdated + increments * COUNT_INTERVAL,
    increments,
  }
}

export function LoginPage() {
  const { session } = useAuth()
  const [userCount, setUserCount] = useState(() => getUserCountState().count)

  useEffect(() => {
    const initialState = getUserCountState()
    localStorage.setItem(USER_COUNT_KEY, String(initialState.count))
    localStorage.setItem(LAST_UPDATED_KEY, String(initialState.lastUpdated))

    const timer = window.setInterval(() => {
      const updatedState = getUserCountState()

      if (updatedState.increments > 0) {
        localStorage.setItem(USER_COUNT_KEY, String(updatedState.count))
        localStorage.setItem(LAST_UPDATED_KEY, String(updatedState.lastUpdated))
        setUserCount(updatedState.count)
      }
    }, COUNT_INTERVAL)

    return () => window.clearInterval(timer)
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
        <div className="mt-6 border-t border-[rgba(212,175,55,0.15)] pt-4 text-center">
          <p className="text-sm text-[#5F7468]">
            Juntos com outros{' '}
            <span className="font-semibold text-[#D4AF37]">
              {userCount.toLocaleString('pt-BR')}
            </span>{' '}
            motoristas
          </p>
        </div>
        <p className="mt-6 text-xs leading-5 text-[#5F7468]">
          O login pede acesso ao Drive só para arquivos criados por este app
          (MotoristaConta-dados.json e MotoristaConta-acessos.json).
        </p>
      </main>
    </div>
  )
}
