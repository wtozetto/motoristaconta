import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const location = useLocation()
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>
  }
  if (!isAuthenticated(session)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
