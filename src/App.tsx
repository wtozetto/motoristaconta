import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { DataProvider } from './data/DataContext'
import { ThemeProvider } from './theme/ThemeContext'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { DriveProvider } from './drive/DriveContext'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireSubscription } from './components/RequireSubscription'

const ConfigPage = lazy(() =>
  import('./pages/ConfigPage').then(({ ConfigPage }) => ({ default: ConfigPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })),
)
const LancamentosPage = lazy(() =>
  import('./pages/LancamentosPage').then(({ LancamentosPage }) => ({ default: LancamentosPage })),
)
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then(({ LoginPage }) => ({ default: LoginPage })),
)
const LembretesPage = lazy(() =>
  import('./pages/LembretesPage').then(({ LembretesPage }) => ({ default: LembretesPage })),
)
const ManutencaoPage = lazy(() =>
  import('./pages/ManutencaoPage').then(({ ManutencaoPage }) => ({ default: ManutencaoPage })),
)
const CategoriasPage = lazy(() =>
  import('./pages/CategoriasPage').then(({ CategoriasPage }) => ({ default: CategoriasPage })),
)
const AtalhosPage = lazy(() =>
  import('./pages/AtalhosPage').then(({ AtalhosPage }) => ({ default: AtalhosPage })),
)
const SubscriptionPage = lazy(() =>
  import('./pages/SubscriptionPage').then(({ SubscriptionPage }) => ({ default: SubscriptionPage })),
)
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then(({ AdminLayout }) => ({ default: AdminLayout })),
)
const DashboardAdmin = lazy(() =>
  import('./pages/admin/DashboardAdmin').then(({ DashboardAdmin }) => ({ default: DashboardAdmin })),
)
const UsersAdmin = lazy(() =>
  import('./pages/admin/UsersAdmin').then(({ UsersAdmin }) => ({ default: UsersAdmin })),
)
const SubscriptionsAdmin = lazy(() =>
  import('./pages/admin/SubscriptionsAdmin').then(({ SubscriptionsAdmin }) => ({ default: SubscriptionsAdmin })),
)
const PaymentsAdmin = lazy(() =>
  import('./pages/admin/PaymentsAdmin').then(({ PaymentsAdmin }) => ({ default: PaymentsAdmin })),
)
const RemindersAdmin = lazy(() =>
  import('./pages/admin/RemindersAdmin').then(({ RemindersAdmin }) => ({ default: RemindersAdmin })),
)
const SettingsAdmin = lazy(() =>
  import('./pages/admin/SettingsAdmin').then(({ SettingsAdmin }) => ({ default: SettingsAdmin })),
)

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
                <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/assinatura"
                element={
                  <RequireAuth>
                    <SubscriptionPage />
                  </RequireAuth>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <RequireSubscription>
                      <DataProvider>
                        <DriveProvider>
                          <Layout />
                        </DriveProvider>
                      </DataProvider>
                    </RequireSubscription>
                  </RequireAuth>
                }
              >
                <Route path="/lancamentos" element={<LancamentosPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/manutencao" element={<ManutencaoPage />} />
                <Route path="/categorias" element={<CategoriasPage />} />
                <Route path="/atalhos" element={<AtalhosPage />} />
                <Route path="/lembretes" element={<LembretesPage />} />
                <Route path="/configuracoes" element={<ConfigPage />} />
              </Route>
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequireAdmin>
                      <AdminLayout />
                    </RequireAdmin>
                  </RequireAuth>
                }
              >
                <Route index element={<DashboardAdmin />} />
                <Route path="usuarios" element={<UsersAdmin />} />
                <Route path="assinaturas" element={<SubscriptionsAdmin />} />
                <Route path="pagamentos" element={<PaymentsAdmin />} />
                <Route path="lembretes" element={<RemindersAdmin />} />
                <Route path="configuracoes" element={<SettingsAdmin />} />
              </Route>
              <Route path="/" element={<Navigate to="/lancamentos" replace />} />
              <Route path="*" element={<Navigate to="/lancamentos" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  )
}
