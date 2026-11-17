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
  it('cria agente por padrão com a senha do Dono e login que não precisa ser email real', async () => {
    const onSubmit = vi.fn()
    render(<UsuarioForm initial={null} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/Nome/i), 'Carlos')
    await userEvent.type(screen.getByLabelText(/Email/i), 'carlos@')
    await userEvent.type(screen.getByLabelText(/^Senha/i), 'curta')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/nome@empresa/i)).toBeInTheDocument()
    expect(screen.getByText(/mínimo 8 caracteres/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Email/i), 'minhaempresa')
    await userEvent.type(screen.getByLabelText(/^Senha/i), '12345')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Carlos', email: 'carlos@minhaempresa', perfil: 'Agente', senha: 'curta12345' })
  })

  it('dono novo não tem senha no formulário e exige email de verdade (recebe convite)', async () => {
    const onSubmit = vi.fn()
    render(<UsuarioForm initial={null} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText(/Perfil/i), 'Dono')
    expect(screen.queryByLabelText(/^Senha/i)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Nome/i), 'Fernanda')
    await userEvent.type(screen.getByLabelText(/Email/i), 'fernanda@empresa')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(screen.getByText(/email válido/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Email/i), '.com')
    await userEvent.click(screen.getByRole('button', { name: /Criar usuário/i }))
    expect(onSubmit).toHaveBeenCalledWith({ nome: 'Fernanda', email: 'fernanda@empresa.com', perfil: 'Dono' })
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
