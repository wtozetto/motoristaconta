import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSubscription } from '../hooks/useSubscription'

export function RequireSubscription({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { subscription, loading, error, enabled, maintenanceMode, accountBlocked } = useSubscription()
  if (!enabled || session?.role === 'admin') return children
  if (loading) return <div className="flex min-h-screen items-center justify-center">Verificando assinatura...</div>
  if (error) return <div role="alert" className="m-6 rounded-xl bg-rose-50 p-4 text-rose-800">{error}</div>
  if (maintenanceMode) return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-bold">Estamos em manutenção</h1><p className="mt-2 text-slate-600">O MotoristaConta volta em breve. Seus dados permanecem seguros.</p></main>
  if (session?.accessBlocked || accountBlocked || !subscription || ['suspended', 'canceled'].includes(subscription.status)) {
    return <Navigate to="/assinatura" replace />
  }
  return children
}
