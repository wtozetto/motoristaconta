import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { RequireAdmin } from '../../components/RequireAdmin'
import type { GoogleSession } from '../../types'
import { AdminLayout } from './AdminLayout'

vi.mock('../../auth/AuthContext', () => ({ useAuth: vi.fn() }))

const session: GoogleSession = {
  googleId: 'admin-test',
  name: 'Admin de teste',
  email: 'admin@example.com',
  lastAccessAt: '2026-11-13T00:00:00.000Z',
  role: 'admin',
}

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route path="/dashboard" element={<p>Aplicativo</p>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<p>Resumo administrativo</p>} />
          <Route path="usuarios" element={<p>Lista de usuários</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('painel administrativo', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('permite ao admin abrir o painel e navegar pelas seções', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session,
      ready: true,
      accessToken: null,
      loginWithCredential: async () => {},
      ensureDriveToken: async () => '',
      loginDevBypass: () => {},
      logout: () => {},
    })
    const user = userEvent.setup()

    renderAdminRoute()

    expect(screen.getByText('MotoristaConta · Admin')).toBeInTheDocument()
    expect(screen.getByText('Resumo administrativo')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Usuários' }))
    expect(screen.getByText('Lista de usuários')).toBeInTheDocument()
  })

  it('redireciona sessões sem login para a tela de login', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      ready: true,
      accessToken: null,
      loginWithCredential: async () => {},
      ensureDriveToken: async () => '',
      loginDevBypass: () => {},
      logout: () => {},
    })

    renderAdminRoute()

    expect(screen.getByText('Tela de login')).toBeInTheDocument()
    expect(screen.queryByText('MotoristaConta · Admin')).not.toBeInTheDocument()
  })

  it('redireciona usuários sem role admin para o aplicativo', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { ...session, role: 'driver' },
      ready: true,
      accessToken: null,
      loginWithCredential: async () => {},
      ensureDriveToken: async () => '',
      loginDevBypass: () => {},
      logout: () => {},
    })

    renderAdminRoute()

    expect(screen.getByText('Aplicativo')).toBeInTheDocument()
    expect(screen.queryByText('MotoristaConta · Admin')).not.toBeInTheDocument()
  })
})
