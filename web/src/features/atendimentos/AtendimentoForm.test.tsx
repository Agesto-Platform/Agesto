import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AtendimentoForm } from './AtendimentoForm'
import type { Cliente } from '../../types/api'

const cliente = { id: 7, nome: 'Vó Joana' } as Cliente

function setup() {
  const onSubmit = vi.fn()
  render(
    <AtendimentoForm clientes={[cliente]} responsaveis={[]} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />,
  )
  return { onSubmit }
}

describe('AtendimentoForm', () => {
  it('exige o cliente antes de criar', async () => {
    const { onSubmit } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Criar atendimento/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Selecione um cliente/i)).toBeInTheDocument()
  })

  it('envia o cliente escolhido, status pendente e sem agenda/responsável', async () => {
    const { onSubmit } = setup()
    await userEvent.selectOptions(screen.getByLabelText(/Cliente/i), '7')
    await userEvent.click(screen.getByRole('button', { name: /Criar atendimento/i }))
    expect(onSubmit).toHaveBeenCalledWith({ clienteId: 7, status: 'Pendente', dataAgendada: null, responsavelId: null })
  })
})
