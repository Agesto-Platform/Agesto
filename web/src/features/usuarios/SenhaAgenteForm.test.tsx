import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SenhaAgenteForm } from './SenhaAgenteForm'

// DEC-59: o Dono define a senha do Agente no painel.
describe('SenhaAgenteForm', () => {
  it('exige 8 caracteres e a mesma senha nos dois campos', async () => {
    const onSubmit = vi.fn()
    render(<SenhaAgenteForm nome="Carla" onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/Nova senha/i), 'curta')
    await userEvent.click(screen.getByRole('button', { name: /Definir senha/i }))
    expect(screen.getByText(/mínimo 8 caracteres/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Nova senha/i), 'Senha')
    await userEvent.type(screen.getByLabelText(/Repita/i), 'outra coisa')
    await userEvent.click(screen.getByRole('button', { name: /Definir senha/i }))
    expect(screen.getByText(/não conferem/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText(/Repita/i))
    await userEvent.type(screen.getByLabelText(/Repita/i), 'curtaSenha')
    await userEvent.click(screen.getByRole('button', { name: /Definir senha/i }))
    expect(onSubmit).toHaveBeenCalledWith('curtaSenha')
  })
})
