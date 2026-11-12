import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { EsqueciSenha } from './EsqueciSenha'
import { RedefinirSenha } from './RedefinirSenha'
import { ApiError } from '../lib/api'

// "Esqueci a senha" do Dono (DEC-54).
const post = vi.hoisted(() => vi.fn())
vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof import('../lib/api')>()),
  api: { post },
}))

beforeEach(() => {
  post.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('EsqueciSenha', () => {
  it('pede o link e responde igual, sem dizer se a conta existe', async () => {
    post.mockResolvedValue(null)
    render(
      <MemoryRouter>
        <EsqueciSenha />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), ' dono@empresa.com ')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(post).toHaveBeenCalledWith('/api/auth/esqueci-senha', { email: 'dono@empresa.com' })
    expect(screen.getByRole('status')).toHaveTextContent('Se dono@empresa.com for o e-mail de um Dono cadastrado')
  })

  it('não envia e-mail inválido', async () => {
    render(
      <MemoryRouter>
        <EsqueciSenha />
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('E-mail'), 'dono')
    await user.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('e-mail válido')
  })
})

describe('RedefinirSenha', () => {
  function abrir(hash: string) {
    window.history.replaceState(null, '', `/redefinir-senha${hash}`)
    render(
      <MemoryRouter>
        <RedefinirSenha />
      </MemoryRouter>,
    )
  }

  it('lê o token depois do # e salva a senha nova', async () => {
    post.mockResolvedValue(null)
    abrir('#token=abc_123-XYZ')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova9')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'SenhaNova9')
    await user.click(screen.getByRole('button', { name: 'Salvar senha nova' }))

    expect(post).toHaveBeenCalledWith('/api/auth/redefinir-senha', { token: 'abc_123-XYZ', novaSenha: 'SenhaNova9' })
    expect(screen.getByText('Senha alterada')).toBeInTheDocument()
    // O token sai da barra de endereço.
    expect(window.location.hash).toBe('')
  })

  it('confere a confirmação antes de enviar', async () => {
    abrir('#token=abc')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova9')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'OutraSenha9')
    await user.click(screen.getByRole('button', { name: 'Salvar senha nova' }))

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('não confere')
  })

  it('link vencido mostra a mensagem da API', async () => {
    post.mockRejectedValue(new ApiError(400, 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".'))
    abrir('#token=velho')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nova senha'), 'SenhaNova9')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'SenhaNova9')
    await user.click(screen.getByRole('button', { name: 'Salvar senha nova' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Link inválido ou expirado')
  })

  it('sem token, não mostra o formulário e oferece pedir outro link', () => {
    abrir('')
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pedir um link novo/ })).toBeInTheDocument()
  })
})
