import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SuportePage } from './SuportePage'
import { ToastProvider } from '../../components/ui'
import type { Ticket } from '../../types/api'

// Aba Suporte do Dono (DEC-60).
const { get, postForm } = vi.hoisted(() => ({ get: vi.fn(), postForm: vi.fn() }))
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof import('../../lib/api')>()),
  api: { get, postForm },
}))

/** Campos do FormData enviado, para comparar. */
function campos(form: FormData) {
  return {
    assunto: form.get('assunto'),
    mensagem: form.get('mensagem'),
    anexos: form.getAll('anexos').map((f) => (f as File).name),
  }
}

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 5,
  assunto: 'Bug',
  status: 'EmAndamento',
  mensagem: 'A agenda não abre no celular.',
  totalRespostas: 1,
  createdAt: '2026-11-17T10:00:00Z',
  updatedAt: '2026-11-17T12:00:00Z',
  resolvidoEm: null,
  ...over,
})

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <SuportePage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('SuportePage', () => {
  beforeEach(() => {
    get.mockReset()
    postForm.mockReset()
  })

  it('lista os chamados e abre a conversa com a resposta da equipe', async () => {
    get.mockImplementation(async (url: string) =>
      url === '/api/suporte'
        ? [ticket()]
        : ticket({ respostas: [{ id: 1, mensagem: 'Estamos olhando.', autor: 'Ana', createdAt: '2026-11-17T12:00:00Z' }] }),
    )
    renderizar()

    expect(await screen.findByText('#5 · Problema (bug)')).toBeInTheDocument()
    expect(screen.getByText('Em andamento')).toBeInTheDocument()

    await userEvent.click(screen.getByText('#5 · Problema (bug)'))
    expect(await screen.findByText('Estamos olhando.')).toBeInTheDocument()
    expect(screen.getByText('Ana · Equipe Agesto')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/api/suporte/5')
  })

  it('abre um chamado com assunto e mensagem, e recusa mensagem curta', async () => {
    get.mockImplementation(async (url: string) => (url === '/api/suporte' ? [] : ticket({ id: 9, status: 'Aberto', totalRespostas: 0, respostas: [] })))
    postForm.mockResolvedValue(ticket({ id: 9, status: 'Aberto', assunto: 'Melhoria', totalRespostas: 0 }))
    renderizar()
    const user = userEvent.setup()

    expect(await screen.findByText('Nenhum chamado aberto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Novo chamado/ }))
    await user.selectOptions(screen.getByLabelText(/Assunto/), 'Melhoria')
    await user.type(screen.getByLabelText(/Mensagem/), 'curta')
    await user.click(screen.getByRole('button', { name: /Enviar chamado/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('pelo menos 10 caracteres')
    expect(postForm).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText(/Mensagem/), ' demais para enviar')
    await user.click(screen.getByRole('button', { name: /Enviar chamado/ }))
    expect(postForm.mock.calls[0][0]).toBe('/api/suporte')
    expect(campos(postForm.mock.calls[0][1])).toEqual({ assunto: 'Melhoria', mensagem: 'curta demais para enviar', anexos: [] })
    expect(await screen.findByText(/Chamado #9 aberto/)).toBeInTheDocument()
  })

  it('anexa imagem e PDF, recusa outro tipo e manda tudo no formulário', async () => {
    get.mockImplementation(async (url: string) => (url === '/api/suporte' ? [] : ticket({ id: 9, respostas: [] })))
    postForm.mockResolvedValue(ticket({ id: 9 }))
    renderizar()
    const user = userEvent.setup({ applyAccept: false })

    await user.click(await screen.findByRole('button', { name: /Novo chamado/ }))
    await user.type(screen.getByLabelText(/Mensagem/), 'Segue o print e o boleto.')
    const input = screen.getByLabelText('Escolher arquivos')

    await user.upload(input, new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' }))
    expect(screen.getByRole('alert')).toHaveTextContent('não é imagem')

    await user.upload(input, [
      new File(['png'], 'print.png', { type: 'image/png' }),
      new File(['%PDF-1.7'], 'boleto.pdf', { type: 'application/pdf' }),
    ])
    expect(await screen.findByText('print.png')).toBeInTheDocument()
    expect(screen.getByText('boleto.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tirar print.png' }))
    expect(screen.queryByText('print.png')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Enviar chamado/ }))
    expect(campos(postForm.mock.calls[0][1]).anexos).toEqual(['boleto.pdf'])
  })

  it('mostra os anexos do chamado com link', async () => {
    get.mockImplementation(async (url: string) =>
      url === '/api/suporte'
        ? [ticket({ totalAnexos: 1 })]
        : ticket({
            respostas: [],
            anexos: [{ id: 3, nomeArquivo: 'erro.webp', contentType: 'image/webp', tamanho: 204800, url: 'https://storage.test/a.webp' }],
          }),
    )
    renderizar()

    await userEvent.click(await screen.findByText('#5 · Problema (bug)'))
    const img = await screen.findByAltText('erro.webp')
    expect(img).toHaveAttribute('src', 'https://storage.test/a.webp')
    expect(screen.getByText('200 KB')).toBeInTheDocument()
  })
})
