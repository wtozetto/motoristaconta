import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAuthenticated } from '../auth/session'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const location = useLocation()
  if (!isAuthenticated(session)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
