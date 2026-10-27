import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { GoogleSession } from '../types'
import { fetchUserInfo } from '../drive/api'
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
  loginWithCredential: (credential: string) => void
  loginWithGoogle: () => Promise<void>
  ensureDriveToken: (prompt?: '' | 'consent') => Promise<string>
  loginDevBypass: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function initialSession(): GoogleSession | null {
  const loaded = loadSession()
  if (!loaded || !isAuthenticated(loaded)) return null
  return touchSession(loaded)
}

function clientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GoogleSession | null>(initialSession)
  const [token, setToken] = useState<TokenState | null>(null)
  const tokenClientRef = useRef<GoogleTokenClient | null>(null)
  const pendingRef = useRef<{
    resolve: (value: GoogleTokenResponse) => void
    reject: (reason: Error) => void
  } | null>(null)

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

  const loginWithGoogle = useCallback(async () => {
    const accessToken = await requestToken('consent')
    const profile = await fetchUserInfo(accessToken)
    const next = sessionFromGoogleProfile(profile)
    saveSession(next)
    setSession(next)
  }, [requestToken])

  const loginWithCredential = useCallback((credential: string) => {
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
    clearSession()
    setToken(null)
    setSession(null)
  }, [token])

  const value = useMemo(
    () => ({
      session,
      ready: true,
      accessToken: token?.accessToken ?? null,
      loginWithCredential,
      loginWithGoogle,
      ensureDriveToken,
      loginDevBypass,
      logout,
    }),
    [
      session,
      token,
      loginWithCredential,
      loginWithGoogle,
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
