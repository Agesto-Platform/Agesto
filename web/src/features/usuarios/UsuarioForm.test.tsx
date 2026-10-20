import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsuarioForm } from './UsuarioForm'
import type { Usuario } from '../../types/api'

const carla: Usuario = {
  id: 7,
  nome: 'Carla',
  email: 'carla@agesto.app',
  perfil: 'Agente',
  ativo: true,
  deveTrocarSenha: false,
  ultimoAcessoEm: null,
  createdAt: '2026-10-01T00:00:00Z',
}

describe('UsuarioForm', () => {
  it('cria agente por padrão e bloqueia email inválido', async () => {
    const onSubmit = vi.fn()
    render(<UsuarioForm initial={null} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/Nome/i), 'Carlos')
    await userEvent.type(screen.getByLabelText(/Email/i), 'carlos@')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/email válido/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Email/i), 'agesto.app')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Carlos', email: 'carlos@agesto.app', perfil: 'Agente' })
  })

  it('na edição mantém o email fixo e envia nome e perfil', async () => {
    const onSubmit = vi.fn()
    render(<UsuarioForm initial={carla} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)

    expect(screen.queryByRole('textbox', { name: /Email/i })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/Perfil/i), 'Dono')
    await userEvent.click(screen.getByRole('button', { name: /Salvar/i }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Carla', email: 'carla@agesto.app', perfil: 'Dono' })
  })
})
