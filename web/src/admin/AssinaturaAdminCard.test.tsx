import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AssinaturaAdminCard } from './AssinaturaAdminCard'
import { ToastProvider } from '../components/ui'
import { adminApi } from './sessao'
import type { Assinatura } from '../types/api'

vi.mock('./sessao', async (importOriginal) => {
  const real = await importOriginal<typeof import('./sessao')>()
  return { ...real, adminApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }
})

const post = vi.mocked(adminApi.post)
const put = vi.mocked(adminApi.put)

const assinatura: Assinatura = {
  situacao: 'EmCarencia', pagoAte: '2026-11-10', diasParaVencer: null, diasDeAtraso: 3, diasParaBloqueio: 8,
  licencasFuncionarios: 2, acessosEmUso: 3, acessosPermitidos: 3, valorMensal: 69.8, ativa: true, bloqueioAutomatico: false,
  pagamentos: [
    { id: 1, valor: 69.8, pagoEm: '2026-10-11', forma: 'Pix', meses: 1, periodoInicio: '2026-10-11', periodoFim: '2026-11-10', observacao: 'Pix do dia 11', adminNome: 'Equipe Agesto', createdAt: '' },
  ],
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AssinaturaAdminCard empresaId={7} assinatura={assinatura} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AssinaturaAdminCard (DEC-58)', () => {
  beforeEach(() => {
    post.mockReset()
    put.mockReset()
  })

  it('mostra a situação, o vencimento, o valor, as licenças e o histórico', () => {
    renderizar()
    expect(screen.getByText('Em carência')).toBeInTheDocument()
    expect(screen.getByText(/Venceu em 10\/11\/2026 \(3 dias de atraso\) · bloqueio automático em 8 dia\(s\)/)).toBeInTheDocument()
    expect(screen.getByText('R$ 69,80', { selector: 'b' })).toBeInTheDocument()
    expect(screen.getByText('3 de 3')).toBeInTheDocument()
    expect(screen.getByText('Pix do dia 11')).toBeInTheDocument()
  })

  it('registra um pagamento com o valor mensal sugerido', async () => {
    post.mockResolvedValue({ ...assinatura, situacao: 'EmDia', pagoAte: '2026-12-10' })
    const user = userEvent.setup()
    renderizar()

    await user.click(screen.getByRole('button', { name: /Registrar pagamento/ }))
    expect(screen.getByLabelText(/Valor/)).toHaveValue('69,80')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(post).toHaveBeenCalledWith('/api/admin/empresas/7/pagamentos', expect.objectContaining({ valor: 69.8, forma: 'Pix', meses: 1 }))
    expect(await screen.findByText(/Pago até 10\/12\/2026/)).toBeInTheDocument()
  })

  it('ajusta as licenças', async () => {
    put.mockResolvedValue({ ...assinatura, licencasFuncionarios: 3 })
    const user = userEvent.setup()
    renderizar()

    await user.click(screen.getByRole('button', { name: 'Ajustar' }))
    const licencas = screen.getByLabelText(/Licenças de funcionário/)
    await user.clear(licencas)
    await user.type(licencas, '3')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(put).toHaveBeenCalledWith('/api/admin/empresas/7/assinatura', { licencasFuncionarios: 3, pagoAte: '2026-11-10' })
  })
})
