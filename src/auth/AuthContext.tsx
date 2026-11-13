import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { GoogleSession } from '../types'
import { supabase } from '../services/supabase'
import { GOOGLE_SCOPES, loadGisScript } from './gis'
import {
  clearSession,
  isAuthenticated,
  loadSession,
  saveSession,
  sessionFromGoogleCredential,
  sessionFromGoogleProfile,
  touchSession,
} from './session'

interface TokenState {
  accessToken: string
  expiresAt: number
}

interface AuthContextValue {
  session: GoogleSession | null
  ready: boolean
  accessToken: string | null
  loginWithCredential: (credential: string) => Promise<void>
  ensureDriveToken: (prompt?: '' | 'consent') => Promise<string>
  loginDevBypass: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function initialSession(): GoogleSession | null {
  const loaded = loadSession()
  if (!loaded || !isAuthenticated(loaded)) return null
  if (loaded.googleId !== 'dev-bypass') {
    try {
      if (!localStorage.getItem('motoristaconta.legacyDataOwner')) {
        localStorage.setItem('motoristaconta.legacyDataOwner', loaded.googleId)
      }
    } catch (error) {
      console.error('Falha ao identificar a base local legada:', error)
    }
  }
  return touchSession(loaded)
}

function clientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GoogleSession | null>(initialSession)
  const [token, setToken] = useState<TokenState | null>(null)
  const [ready, setReady] = useState(!supabase)
  const tokenClientRef = useRef<GoogleTokenClient | null>(null)
  const pendingRef = useRef<{
    resolve: (value: GoogleTokenResponse) => void
    reject: (reason: Error) => void
  } | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    const applySupabaseSession = async (user: {
      id: string
      email?: string
      user_metadata?: Record<string, unknown>
      identities?: Array<{ provider?: string; identity_data?: Record<string, unknown> }>
    } | null) => {
      if (!user) {
        if (active) setSession(null)
        return
      }
      let role: GoogleSession['role'] = 'driver'
      let accessBlocked = false
      const { data, error } = await client
        .from('profiles')
        .select('role, access_blocked')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Falha ao carregar o perfil do usuário:', error)
      } else if (data) {
        role = data.role === 'admin' ? 'admin' : 'driver'
        accessBlocked = data.access_blocked === true
      }
      if (!active) return
      const email = user.email ?? ''
      setSession({
        googleId: String(user.identities?.find((identity) => identity.provider === 'google')?.identity_data?.sub ?? user.id),
        supabaseUserId: user.id,
        name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? email),
        email,
        role,
        accessBlocked,
        lastAccessAt: new Date().toISOString(),
      })
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, authSession) => {
      void applySupabaseSession(authSession?.user ?? null).finally(() => setReady(true))
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const applyToken = useCallback((response: GoogleTokenResponse): string => {
    if (response.error || !response.access_token) {
      throw new Error(response.error_description || 'Permissão do Google negada.')
    }
    const expiresIn = Number(response.expires_in ?? 3600) * 1000
    setToken({
      accessToken: response.access_token,
      expiresAt: Date.now() + expiresIn,
    })
    return response.access_token
  }, [])

  const ensureTokenClient = useCallback(async () => {
    const id = clientId()
    if (!id) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado.')
    await loadGisScript()
    if (!window.google?.accounts.oauth2) {
      throw new Error('Google Identity Services indisponível.')
    }
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          pendingRef.current?.resolve(response)
          pendingRef.current = null
        },
        error_callback: (error) => {
          pendingRef.current?.reject(
            new Error(error.message || error.type || 'Falha no login Google.'),
          )
          pendingRef.current = null
        },
      })
    }
    return tokenClientRef.current
  }, [])

  const requestToken = useCallback(
    async (prompt: '' | 'consent') => {
      const client = await ensureTokenClient()
      const response = await new Promise<GoogleTokenResponse>((resolve, reject) => {
        pendingRef.current = { resolve, reject }
        client.requestAccessToken({ prompt })
      })
      return applyToken(response)
    },
    [applyToken, ensureTokenClient],
  )

  const ensureDriveToken = useCallback(
    async (prompt: '' | 'consent' = '') => {
      if (token && token.expiresAt > Date.now() + 30_000) {
        return token.accessToken
      }
      return requestToken(prompt)
    },
    [requestToken, token],
  )

  const loginWithCredential = useCallback(async (credential: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
      })
      if (error) throw error
      const user = data.user
      if (!user) throw new Error('O Supabase não retornou o usuário autenticado.')
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, access_blocked')
        .eq('id', user.id)
        .maybeSingle()
      if (profileError) throw profileError
      const next = {
        ...sessionFromGoogleProfile({
          sub: String(user.identities?.find((identity) => identity.provider === 'google')?.identity_data?.sub ?? user.id),
          name: String(user.user_metadata.full_name ?? user.user_metadata.name ?? ''),
          email: user.email,
        }),
        supabaseUserId: user.id,
        role: profile?.role === 'admin' ? 'admin' as const : 'driver' as const,
        accessBlocked: profile?.access_blocked === true,
      }
      saveSession(next)
      setSession(next)
      return
    }
    const next = sessionFromGoogleCredential(credential)
    saveSession(next)
    setSession(next)
  }, [])

  const loginDevBypass = useCallback(() => {
    const next: GoogleSession = {
      googleId: 'dev-bypass',
      name: 'Motorista (teste)',
      email: 'dev@localhost',
      lastAccessAt: new Date().toISOString(),
    }
    saveSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    if (token?.accessToken && window.google?.accounts.oauth2) {
      window.google.accounts.oauth2.revoke(token.accessToken)
    }
    if (supabase) void supabase.auth.signOut().then(({ error }) => {
      if (error) console.error('Falha ao encerrar sessão Supabase:', error)
    })
    clearSession()
    setToken(null)
    setSession(null)
  }, [token])

  const value = useMemo(
    () => ({
      session,
      ready,
      accessToken: token?.accessToken ?? null,
      loginWithCredential,
      ensureDriveToken,
      loginDevBypass,
      logout,
    }),
    [
      session,
      ready,
      token,
      loginWithCredential,
      ensureDriveToken,
      loginDevBypass,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de AuthProvider')
  }
  return ctx
}
