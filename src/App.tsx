import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { DataProvider } from './data/DataContext'
import { ThemeProvider } from './theme/ThemeContext'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { DriveProvider } from './drive/DriveContext'
import { ConfigPage } from './pages/ConfigPage'
import { DashboardPage } from './pages/DashboardPage'
import { LancamentosPage } from './pages/LancamentosPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
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
              <Route path="/configuracoes" element={<ConfigPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/lancamentos" replace />} />
            <Route path="*" element={<Navigate to="/lancamentos" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
