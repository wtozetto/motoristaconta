import type { GoogleSession } from '../types'

export const SESSION_STORAGE_KEY = 'motoristaconta.session'

export function loadSession(): GoogleSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GoogleSession>
    if (!parsed.googleId || !parsed.email) return null
    return {
      googleId: parsed.googleId,
      name: parsed.name ?? '',
      email: parsed.email,
      lastAccessAt: parsed.lastAccessAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function saveSession(session: GoogleSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function touchSession(session: GoogleSession): GoogleSession {
  const next = { ...session, lastAccessAt: new Date().toISOString() }
  saveSession(next)
  return next
}

export function isAuthenticated(session: GoogleSession | null): boolean {
  return Boolean(session?.googleId && session.email)
}

export interface GoogleJwtPayload {
  sub: string
  name?: string
  email?: string
}

export function decodeJwtPayload(credential: string): GoogleJwtPayload {
  const payload = credential.split('.')[1]
  if (!payload) {
    throw new Error('Credencial Google inválida.')
  }
  const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
  const json = atob(normalized)
  return JSON.parse(json) as GoogleJwtPayload
}

export function sessionFromGoogleProfile(profile: {
  sub: string
  name?: string
  email?: string
}): GoogleSession {
  if (!profile.sub || !profile.email) {
    throw new Error('O login Google não retornou id e e-mail.')
  }
  return {
    googleId: profile.sub,
    name: profile.name ?? profile.email,
    email: profile.email,
    lastAccessAt: new Date().toISOString(),
  }
}

export function sessionFromGoogleCredential(credential: string): GoogleSession {
  return sessionFromGoogleProfile(decodeJwtPayload(credential))
}
