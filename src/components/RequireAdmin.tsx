import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  if (!ready) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}
