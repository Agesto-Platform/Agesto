import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthContext, type AuthContextValue } from './context'

const TERMOS = { versao: '2026-11', urlTermos: '/termos', urlPrivacidade: '/privacidade' }

function auth(over: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: { sub: '1', perfil: 'Dono' },
    isAuthenticated: true,
    deveTrocarSenha: false,
    termos: null,
    login: vi.fn(),
    trocarSenha: vi.fn(),
    aceitarTermos: vi.fn(),
    logout: vi.fn(),
    ...over,
  }
}

function emRota(caminho: string, valor: AuthContextValue) {
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route path="/login" element={<p>tela login</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<p>tela painel</p>} />
            <Route path="/aceitar-termos" element={<p>tela termos</p>} />
            <Route path="/trocar-senha" element={<p>tela senha</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('com termos pendentes, prende na tela de aceite', () => {
    emRota('/', auth({ termos: TERMOS }))
    expect(screen.getByText('tela termos')).toBeInTheDocument()
  })

  it('termos vêm antes da troca de senha provisória', () => {
    emRota('/trocar-senha', auth({ termos: TERMOS, deveTrocarSenha: true }))
    expect(screen.getByText('tela termos')).toBeInTheDocument()
  })

  it('depois do aceite, segue para a troca de senha se ela estiver pendente', () => {
    emRota('/aceitar-termos', auth({ deveTrocarSenha: true }))
    expect(screen.getByText('tela senha')).toBeInTheDocument()
  })

  it('sem pendências, a tela de aceite volta para o painel', () => {
    emRota('/aceitar-termos', auth({}))
    expect(screen.getByText('tela painel')).toBeInTheDocument()
  })

  it('sem login, vai para o login', () => {
    emRota('/', auth({ user: null, isAuthenticated: false, termos: TERMOS }))
    expect(screen.getByText('tela login')).toBeInTheDocument()
  })
})
