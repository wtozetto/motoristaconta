import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'
import { GoogleSignIn } from '../components/GoogleSignIn'
import { supabase } from '../services/supabase'

const COUNT_INTERVAL = 5 * 60 * 1000

type EmailMode = 'login' | 'signup' | 'forgot'

export function LoginPage() {
  const { session, ready } = useAuth()
  const [userCount, setUserCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailMode, setEmailMode] = useState<EmailMode>('login')
  const [passwordRecovery, setPasswordRecovery] = useState(
    () =>
      new URLSearchParams(window.location.search).get('recovery') === '1'
      || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery',
  )
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

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

  if (isAuthenticated(session) && !passwordRecovery) {
    return <Navigate to="/lancamentos" replace />
  }

  if (passwordRecovery && !ready) {
    return (
      <div className="login-page flex min-h-dvh items-center justify-center px-4 py-8">
        <p role="status" className="login-card rounded-2xl p-6 text-sm">Validando link de recuperação...</p>
      </div>
    )
  }

  if (passwordRecovery && ready && !session) {
    return (
      <div className="login-page flex min-h-dvh items-center justify-center px-4 py-8">
        <main className="login-card w-full max-w-md rounded-2xl p-6 sm:p-8">
          <h1 className="text-xl font-bold text-[#0C5C38]">Link de recuperação inválido</h1>
          <p className="mt-2 text-sm text-[#5F7468]">
            O link expirou ou não pôde ser validado. Solicite um novo link para redefinir sua senha.
          </p>
          <button
            type="button"
            onClick={() => {
              setPasswordRecovery(false)
              setEmailMode('forgot')
            }}
            className="mt-4 h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
          >
            Solicitar outro link
          </button>
        </main>
      </div>
    )
  }

  async function handleEmailAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setEmailLoading(true)
    setEmailMessage(null)
    setEmailError(null)
    try {
      if (passwordRecovery) {
        if (!session) throw new Error('O link de recuperação expirou. Solicite um novo link.')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setEmailMessage('Senha alterada com sucesso.')
        setPasswordRecovery(false)
        setEmailMode('login')
        window.history.replaceState(null, '', window.location.pathname)
      } else if (emailMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (emailMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setEmailMessage('Verifique seu e-mail para confirmar o cadastro.')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?recovery=1`,
        })
        if (error) throw error
        setEmailMessage('Enviamos um link de recuperação para seu e-mail.')
      }
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.')
    } finally {
      setEmailLoading(false)
    }
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
        {!passwordRecovery ? <GoogleSignIn /> : null}
        {supabase ? (
          <section className="mt-6 border-t border-[rgba(212,175,55,0.15)] pt-5">
            {passwordRecovery ? (
              <h2 className="mb-4 font-semibold">Defina sua nova senha</h2>
            ) : (
              <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {([
                  ['login', 'Entrar'],
                  ['signup', 'Cadastrar'],
                  ['forgot', 'Recuperar senha'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={emailMode === mode}
                    onClick={() => {
                      setEmailMode(mode)
                      setEmailMessage(null)
                      setEmailError(null)
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium ${
                      emailMode === mode
                        ? 'bg-white text-emerald-800 shadow dark:bg-slate-700 dark:text-emerald-200'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(event) => void handleEmailAuth(event)} className="space-y-3">
              {!passwordRecovery ? (
                <label className="block text-sm font-medium">
                  E-mail
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              ) : null}
              {passwordRecovery || emailMode !== 'forgot' ? (
                <label className="block text-sm font-medium">
                  {passwordRecovery ? 'Nova senha' : 'Senha'}
                  <input
                    required
                    type="password"
                    minLength={6}
                    autoComplete={passwordRecovery || emailMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              ) : null}
              <button
                type="submit"
                disabled={emailLoading}
                className="h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {emailLoading
                  ? 'Processando...'
                  : passwordRecovery
                    ? 'Alterar senha'
                    : emailMode === 'login'
                      ? 'Entrar com e-mail'
                      : emailMode === 'signup'
                        ? 'Criar conta'
                        : 'Enviar link de recuperação'}
              </button>
            </form>
            {emailMessage ? <p role="status" className="mt-3 text-center text-sm text-emerald-700">{emailMessage}</p> : null}
            {emailError ? <p role="alert" className="mt-3 text-center text-sm text-rose-600">{emailError}</p> : null}
          </section>
        ) : null}
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
