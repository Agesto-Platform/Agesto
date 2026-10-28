import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AceitarTermos } from './AceitarTermos'
import { AuthContext, type AuthContextValue } from '../auth/context'
import { ApiError } from '../lib/api'

const TERMOS = { versao: '2026-11', urlTermos: 'https://agesto.pages.dev/termos', urlPrivacidade: 'https://agesto.pages.dev/privacidade' }

function renderTela(over: Partial<AuthContextValue> = {}) {
  const valor: AuthContextValue = {
    user: { sub: '1', perfil: 'Dono' },
    isAuthenticated: true,
    deveTrocarSenha: false,
    termos: TERMOS,
    login: vi.fn(),
    trocarSenha: vi.fn(),
    aceitarTermos: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    ...over,
  }
  render(
    <AuthContext.Provider value={valor}>
      <MemoryRouter>
        <AceitarTermos />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return valor
}

describe('AceitarTermos', () => {
  it('mostra os dois documentos com os links da API e a versão', () => {
    renderTela()
    expect(screen.getByRole('link', { name: /Termos de uso/ })).toHaveAttribute('href', TERMOS.urlTermos)
    expect(screen.getByRole('link', { name: /Política de privacidade/ })).toHaveAttribute('href', TERMOS.urlPrivacidade)
    expect(screen.getByText('Versão 2026-11')).toBeInTheDocument()
  })

  it('sem link configurado, mostra o documento sem link', () => {
    renderTela({ termos: { versao: '2026-11', urlTermos: null, urlPrivacidade: null } })
    expect(screen.getByText('Termos de uso')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Termos de uso/ })).not.toBeInTheDocument()
  })

  it('"Li e aceito" registra o aceite', async () => {
    const valor = renderTela()
    await userEvent.click(screen.getByRole('button', { name: 'Li e aceito' }))
    expect(valor.aceitarTermos).toHaveBeenCalledTimes(1)
  })

  it('se a API recusar, mostra o motivo', async () => {
    renderTela({
      aceitarTermos: vi.fn().mockRejectedValue(new ApiError(409, 'Os termos mudaram. Entre de novo para ler a versão atual.')),
    })
    await userEvent.click(screen.getByRole('button', { name: 'Li e aceito' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Os termos mudaram')
  })

  it('"Sair" encerra a sessão', async () => {
    const valor = renderTela()
    await userEvent.click(screen.getByRole('button', { name: /Sair/ }))
    expect(valor.logout).toHaveBeenCalledTimes(1)
  })
})
