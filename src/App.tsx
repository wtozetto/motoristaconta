import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { DataProvider } from './data/DataContext'
import { ThemeProvider } from './theme/ThemeContext'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { DriveProvider } from './drive/DriveContext'

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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
                element={
                  <RequireAuth>
                    <DataProvider>
                      <DriveProvider>
                        <Layout />
                      </DriveProvider>
                    </DataProvider>
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
              <Route path="/" element={<Navigate to="/lancamentos" replace />} />
              <Route path="*" element={<Navigate to="/lancamentos" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
