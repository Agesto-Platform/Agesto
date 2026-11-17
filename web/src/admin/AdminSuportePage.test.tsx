import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminSuportePage } from './AdminSuportePage'
import { ToastProvider } from '../components/ui'
import { adminApi } from './sessao'
import type { Ticket } from '../types/api'

vi.mock('./sessao', async (importOriginal) => {
  const real = await importOriginal<typeof import('./sessao')>()
  return { ...real, adminApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() } }
})

const get = vi.mocked(adminApi.get)
const post = vi.mocked(adminApi.post)
const put = vi.mocked(adminApi.put)

const ticket: Ticket = {
  id: 7,
  assunto: 'Duvida',
  status: 'Aberto',
  mensagem: 'Como cadastro um agente sem email?',
  totalRespostas: 0,
  createdAt: '2026-11-17T10:00:00Z',
  updatedAt: '2026-11-17T10:00:00Z',
  resolvidoEm: null,
  empresaId: 3,
  empresaNome: 'Refri Sul',
  donoNome: 'Marta',
  donoEmail: 'marta@refrisul.com',
  respostas: [],
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AdminSuportePage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

// Chamados no superadmin (DEC-60).
describe('AdminSuportePage', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
    get.mockImplementation(async (url: string) => (url.startsWith('/api/admin/suporte/') ? ticket : [ticket]))
  })

  it('mostra empresa e Dono, responde e já põe em andamento', async () => {
    post.mockResolvedValue({ ...ticket, status: 'EmAndamento' })
    renderizar()
    const user = userEvent.setup()

    expect(await screen.findByText('Refri Sul')).toBeInTheDocument()
    expect(screen.getByText('1 abertos')).toBeInTheDocument()
    await user.click(screen.getByText('#7 · Dúvida'))
    expect(await screen.findByText('Como cadastro um agente sem email?', { selector: 'p' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Responder ao Dono'), 'Use a senha definida pelo Dono.')
    await user.click(screen.getByRole('button', { name: /Enviar resposta/ }))
    expect(post).toHaveBeenCalledWith('/api/admin/suporte/7/respostas', {
      mensagem: 'Use a senha definida pelo Dono.',
      status: 'EmAndamento',
    })
    expect(await screen.findByText(/Resposta enviada\. Marta recebe um email/)).toBeInTheDocument()
  })

  it('avança o status sem responder', async () => {
    put.mockResolvedValue({ ...ticket, status: 'Resolvido' })
    renderizar()
    const user = userEvent.setup()

    await user.click(await screen.findByText('#7 · Dúvida'))
    await user.click(await screen.findByRole('button', { name: 'Marcar resolvido' }))
    expect(put).toHaveBeenCalledWith('/api/admin/suporte/7/status', { status: 'Resolvido' })
  })

  it('filtra pela situação', async () => {
    renderizar()
    const user = userEvent.setup()
    await screen.findByText('Refri Sul')

    await user.click(screen.getByRole('button', { name: 'Resolvido' }))
    expect(get).toHaveBeenCalledWith('/api/admin/suporte?status=Resolvido')
  })
})
