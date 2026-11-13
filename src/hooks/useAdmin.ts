import { useAuth } from '../auth/AuthContext'

export function useAdmin() {
  const { session, ready } = useAuth()
  return {
    loading: !ready,
    isAdmin: session?.role === 'admin',
    userId: session?.supabaseUserId ?? null,
  }
}
