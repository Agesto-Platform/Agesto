import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AtendimentoForm } from './AtendimentoForm'
import type { Cliente } from '../../types/api'

const cliente = { id: 7, nome: 'Vó Joana', cidade: 'Campinas' } as Cliente

// PAG-01 fase 2: o cliente vem da busca no servidor (/api/cliente?pagina=1&tamanho=20&busca=).
const get = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: { get },
}))

function setup() {
  get.mockResolvedValue({ itens: [cliente], pagina: 1, tamanho: 20, total: 1 })
  const onSubmit = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <AtendimentoForm responsaveis={[]} onSubmit={onSubmit} submitting={false} onCancel={vi.fn()} />
    </QueryClientProvider>,
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

  it('busca o cliente no servidor e envia o escolhido, pendente e sem agenda/responsável', async () => {
    const { onSubmit } = setup()
    const user = userEvent.setup()
    await user.type(screen.getByRole('combobox', { name: /Cliente/i }), 'joa')
    // A busca espera a digitação parar antes de pedir ao servidor.
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/cliente?pagina=1&tamanho=20&busca=joa'))
    await user.click(await screen.findByRole('option', { name: /Vó Joana/ }))

    expect(screen.getByRole('combobox', { name: /Cliente/i })).toHaveValue('Vó Joana')

    await user.click(screen.getByRole('button', { name: /Criar atendimento/i }))
    expect(onSubmit).toHaveBeenCalledWith({ clienteId: 7, status: 'Pendente', dataAgendada: null, responsavelId: null })
  })
})
