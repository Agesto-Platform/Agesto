import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Recebimento, SeloRecebimento } from './Recebimento'
import { ToastProvider } from '../../components/ui'
import type { Atendimento } from '../../types/api'

// Cobrança mínima (TASKS L5): PUT /api/atendimento/{id}/recebimento.
const put = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: { put },
}))

const base = { id: 9, status: 'Concluido', valorTotal: 350, pagoEm: null, formaPagamento: null } as unknown as Atendimento

function renderizar(a: Atendimento) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <Recebimento atendimento={a} />
        <SeloRecebimento atendimento={a} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Recebimento', () => {
  beforeEach(() => put.mockReset())

  it('concluído sem pagamento fica a receber e registra data e forma', async () => {
    put.mockResolvedValue({ ...base, pagoEm: '2026-11-10', formaPagamento: 'Dinheiro' })
    renderizar(base)
    expect(screen.getByText('A receber')).toBeInTheDocument()

    const user = userEvent.setup()
    const data = screen.getByLabelText(/Pago em/)
    await user.clear(data)
    await user.type(data, '2026-11-10')
    await user.selectOptions(screen.getByLabelText(/Forma/), 'Dinheiro')
    await user.click(screen.getByRole('button', { name: /Registrar recebimento/ }))

    expect(put).toHaveBeenCalledWith('/api/atendimento/9/recebimento', { pagoEm: '2026-11-10', forma: 'Dinheiro' })
    expect(await screen.findByText('Recebimento registrado.')).toBeInTheDocument()
  })

  it('pago mostra quando e como, e pode voltar para a receber', async () => {
    put.mockResolvedValue(base)
    renderizar({ ...base, pagoEm: '2026-11-13', formaPagamento: 'CartaoCredito' })
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByText('Recebido em 13/11/2026')).toBeInTheDocument()
    expect(screen.getByText(/Cartão de crédito/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Voltar para a receber/ }))
    expect(put).toHaveBeenCalledWith('/api/atendimento/9/recebimento', { pagoEm: null, forma: null })
  })

  it('cancelado sem pagamento não mostra cobrança', () => {
    renderizar({ ...base, status: 'Cancelado' })
    expect(screen.queryByRole('region', { name: 'Recebimento' })).toBeNull()
    expect(screen.queryByText('A receber')).toBeNull()
  })
})
