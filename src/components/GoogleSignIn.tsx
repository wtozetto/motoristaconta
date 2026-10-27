import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function GoogleSignIn() {
  const { loginWithGoogle, loginDevBypass } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const allowBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

  async function onGoogle() {
    setError(null)
    setBusy(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login Google.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {clientId ? (
        <button
          type="button"
          onClick={() => void onGoogle()}
          disabled={busy}
          className="flex h-12 w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
        >
          {busy ? 'Conectando…' : 'Entrar com Google'}
        </button>
      ) : (
        <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Configure o login Google</p>
          <p className="mt-1">
            Defina <code className="rounded bg-white/70 px-1 dark:bg-black/30">VITE_GOOGLE_CLIENT_ID</code> no
            arquivo <code className="rounded bg-white/70 px-1 dark:bg-black/30">.env</code> e nas variáveis de
            ambiente da Vercel. Ative a API do Google Drive no Cloud Console.
          </p>
        </div>
      )}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {allowBypass ? (
        <button
          type="button"
          onClick={loginDevBypass}
          className="h-11 rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          Entrar em modo de teste (somente desenvolvimento)
        </button>
      ) : null}
    </div>
  )
}
