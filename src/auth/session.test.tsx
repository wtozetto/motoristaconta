import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { RequireAuth } from '../components/RequireAuth'
import type { GoogleSession } from '../types'
import { AuthProvider } from './AuthContext'
import {
  clearSession,
  isAuthenticated,
  loadSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from './session'

const sample: GoogleSession = {
  googleId: 'gid-1',
  name: 'Ana Motorista',
  email: 'ana@example.com',
  lastAccessAt: '2026-10-14T12:00:00.000Z',
}

describe('sessão local', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persiste id, nome, e-mail e último acesso', () => {
    saveSession(sample)
    expect(loadSession()).toEqual(sample)
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').email).toBe(
      'ana@example.com',
    )
  })

  it('logout limpa a sessão', () => {
    saveSession(sample)
    clearSession()
    expect(loadSession()).toBeNull()
    expect(isAuthenticated(null)).toBe(false)
  })
})

describe('guarda de rota (sessão mockada)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sem login mostra apenas a tela de login', () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/lancamentos']}>
          <Routes>
            <Route path="/login" element={<p>Tela de login</p>} />
            <Route
              path="/lancamentos"
              element={
                <RequireAuth>
                  <p>Área logada</p>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
    expect(screen.queryByText('Área logada')).not.toBeInTheDocument()
  })

  it('com sessão mockada libera a área autenticada', () => {
    saveSession(sample)
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/lancamentos']}>
          <Routes>
            <Route path="/login" element={<p>Tela de login</p>} />
            <Route
              path="/lancamentos"
              element={
                <RequireAuth>
                  <p>Área logada</p>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    expect(screen.getByText('Área logada')).toBeInTheDocument()
  })
})
