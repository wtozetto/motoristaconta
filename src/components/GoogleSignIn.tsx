import { useEffect, useRef, useState } from 'react'
import { loadGisScript } from '../auth/gis'
import { useAuth } from '../auth/AuthContext'

export function GoogleSignIn() {
  const { loginWithCredential, loginDevBypass } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const allowBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

  useEffect(() => {
    let active = true
    if (!clientId || !buttonRef.current) return
    void loadGisScript()
      .then(() => {
        if (!active || !buttonRef.current || !window.google?.accounts.id) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setError(null)
            setBusy(true)
            void loginWithCredential(response.credential)
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Falha no login Google.')
              })
              .finally(() => setBusy(false))
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
          locale: 'pt-BR',
        })
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar o login Google.')
      })
    return () => {
      active = false
    }
  }, [clientId, loginWithCredential])

  return (
    <div className="flex flex-col items-center gap-4">
      {clientId ? (
        <div className="relative min-h-10 w-full">
          <div ref={buttonRef} className={busy ? 'pointer-events-none opacity-50' : ''} />
          {busy ? <span className="mt-2 block text-center text-sm">Conectando…</span> : null}
        </div>
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
