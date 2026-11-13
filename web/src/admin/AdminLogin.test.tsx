import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminLogin } from './AdminLogin'
import { adminApi } from './sessao'
import { ApiError } from '../lib/api'

vi.mock('./sessao', async (importOriginal) => {
  const real = await importOriginal<typeof import('./sessao')>()
  return { ...real, adminApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }
})

const post = vi.mocked(adminApi.post)

function jwt(): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64({ sub: '1', escopo: 'plataforma', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
}

function renderizar() {
  render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<p>painel do admin</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function preencherSenha() {
  const user = userEvent.setup()
  await user.clear(screen.getByLabelText(/Email/))
  await user.type(screen.getByLabelText(/Email/), 'equipe@agesto.com')
  await user.clear(screen.getByLabelText(/Senha/))
  await user.type(screen.getByLabelText(/Senha/), 'senha-bem-longa-123')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  return user
}

describe('AdminLogin (duas etapas, DEC-52)', () => {
  beforeEach(() => {
    localStorage.clear()
    post.mockReset()
  })

  it('depois da senha pede o código e entra com o código certo', async () => {
    post.mockResolvedValueOnce({ token: '', exigeCodigo: true, desafio: 'abc', emailMascarado: 'eq***@agesto.com' })
    post.mockResolvedValueOnce({ token: jwt(), expiresAt: '', admin: {} })
    renderizar()

    const user = await preencherSenha()
    expect(await screen.findByText(/Enviamos um código de 6 números para eq\*\*\*@agesto.com/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Código/), '123456')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('painel do admin')).toBeInTheDocument()
    expect(post).toHaveBeenLastCalledWith('/api/admin/auth/login/codigo', { desafio: 'abc', codigo: '123456' })
  })

  it('código errado mostra o erro e continua na tela do código', async () => {
    post.mockResolvedValueOnce({ token: '', exigeCodigo: true, desafio: 'abc', emailMascarado: null })
    post.mockRejectedValueOnce(new ApiError(401, 'Código inválido ou expirado. Confira o email ou entre de novo.'))
    renderizar()

    const user = await preencherSenha()
    await user.type(await screen.findByLabelText(/Código/), '000000')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou expirado')
    expect(screen.getByLabelText(/Código/)).toBeInTheDocument()
  })

  it('conta bloqueada mostra a mensagem da API', async () => {
    post.mockRejectedValueOnce(new ApiError(423, 'Conta bloqueada por excesso de tentativas. Tente de novo em 15 min.'))
    renderizar()

    await preencherSenha()

    expect(await screen.findByRole('alert')).toHaveTextContent('Conta bloqueada')
  })
})
