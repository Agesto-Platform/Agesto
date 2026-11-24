import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentPanel } from './AgentPanel'
import { api, ApiError } from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/api')>()
  return { ...real, api: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }
})
vi.mock('./useConta', () => ({
  useConta: () => ({ nome: 'Davi', email: 'davi@exemplo.com', inicial: 'D', empresa: null }),
  saudacao: () => 'Boa tarde',
}))
vi.mock('../components/Mascote', () => ({ Mascote: () => null }))

const post = vi.mocked(api.post)
const get = vi.mocked(api.get)
const put = vi.mocked(api.put)

/** Proposta da fase 2 (DEC-62): cancelar o atendimento 5 do Bruno. */
const PROPOSTA = {
  tipo: 'atendimento',
  clienteId: 10,
  clienteNome: 'Bruno',
  atendimentoId: 5,
  servico: 'Limpeza',
  dataAtual: '2026-11-27T17:30:00Z',
  responsavelAtualId: 4,
  responsavelAtualNome: 'João',
  novoStatus: 'Cancelado',
  novaData: null,
  novoResponsavelId: null,
  novoResponsavelNome: null,
} as const

describe('AgentPanel', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    put.mockReset()
    get.mockResolvedValue({ limite: 20, usadas: 3, restantes: 17 })
  })

  it('mostra quantas perguntas restam hoje e atualiza depois da resposta', async () => {
    post.mockResolvedValue({ resposta: 'Ok.', modelo: 'm', perguntasRestantes: 16, limiteDiario: 20 })
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    expect(await screen.findByText(/17 de 20 perguntas hoje/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Oi{Enter}')
    expect(await screen.findByText(/16 de 20 perguntas hoje/)).toBeInTheDocument()
  })

  it('no limite do dia, avisa e trava a caixa de pergunta', async () => {
    post.mockRejectedValue(new ApiError(429, 'Sua empresa já fez as 20 perguntas de hoje ao Agente. O limite recomeça amanhã.'))
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Oi{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('20 perguntas de hoje')
    expect(screen.getByText('Perguntas de hoje esgotadas')).toBeInTheDocument()
    expect(screen.getByLabelText('Pergunta para o Agente')).toBeDisabled()
  })

  it('com as perguntas do dia já esgotadas, abre travado', async () => {
    get.mockResolvedValue({ limite: 20, usadas: 20, restantes: 0 })
    render(<AgentPanel period="mes" onClose={() => {}} />)

    expect(await screen.findByText('Perguntas de hoje esgotadas')).toBeInTheDocument()
    expect(screen.getByLabelText('Pergunta para o Agente')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Quanto sobrou este mês\?/ })).toBeDisabled()
  })

  it('envia a pergunta com o período e mostra a resposta do Agente', async () => {
    post.mockResolvedValue({ resposta: 'Sobraram R$ 1.100,00.', modelo: 'claude-haiku-5-5' })
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Quanto sobrou?{Enter}')

    expect(await screen.findByText('Sobraram R$ 1.100,00.')).toBeInTheDocument()
    expect(screen.getByText('Quanto sobrou?')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith(
      '/api/agente/perguntar',
      expect.objectContaining({ pergunta: 'Quanto sobrou?', historico: [], de: expect.any(String), ate: expect.any(String) }),
    )
  })

  it('o atalho pergunta direto e a próxima pergunta leva o histórico', async () => {
    post.mockResolvedValueOnce({ resposta: 'Restam 6 kg de gás.', modelo: 'm' })
    post.mockResolvedValueOnce({ resposta: 'Repor 20 kg.', modelo: 'm' })
    const user = userEvent.setup()
    render(<AgentPanel period="7d" onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /O que está acabando\?/ }))
    expect(await screen.findByText('Restam 6 kg de gás.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Quanto repor?{Enter}')
    expect(await screen.findByText('Repor 20 kg.')).toBeInTheDocument()

    expect(post).toHaveBeenLastCalledWith(
      '/api/agente/perguntar',
      expect.objectContaining({
        pergunta: 'Quanto repor?',
        historico: [
          { papel: 'usuario', texto: 'O que está acabando?' },
          { papel: 'agente', texto: 'Restam 6 kg de gás.' },
        ],
      }),
    )
  })

  it('mostra o rascunho de WhatsApp com o link e não manda o rascunho no histórico', async () => {
    post.mockResolvedValueOnce({
      resposta: 'Preparei a cobrança do Bruno.',
      modelo: 'm',
      acoes: [{ tipo: 'whatsapp', clienteId: 10, clienteNome: 'Bruno', telefone: '(11) 91111-2222', mensagem: 'Oi, Bruno! Lembrete do pagamento.' }],
    })
    post.mockResolvedValueOnce({ resposta: 'Ok.', modelo: 'm' })
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Quem está me devendo\?/ }))

    const link = await screen.findByRole('link', { name: /Revisar e enviar para Bruno/ })
    expect(link).toHaveAttribute('href', `https://wa.me/5511911112222?text=${encodeURIComponent('Oi, Bruno! Lembrete do pagamento.')}`)
    expect(screen.getByText('Oi, Bruno! Lembrete do pagamento.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Obrigado{Enter}')
    expect(await screen.findByText('Ok.')).toBeInTheDocument()
    expect(post).toHaveBeenLastCalledWith(
      '/api/agente/perguntar',
      expect.objectContaining({
        historico: [
          { papel: 'usuario', texto: 'Quem está me devendo?' },
          { papel: 'agente', texto: 'Preparei a cobrança do Bruno.' },
        ],
      }),
    )
  })

  it('proposta de mudança: só grava quando o Dono confirma', async () => {
    post.mockResolvedValue({ resposta: 'Propus cancelar o atendimento do Bruno.', modelo: 'm', acoes: [PROPOSTA] })
    get.mockImplementation(async (url: string) =>
      url === '/api/atendimento/5'
        ? { id: 5, status: 'Pendente', dataAgendada: '2026-11-27T17:30:00Z', usuarioId: 4 }
        : { limite: 20, usadas: 3, restantes: 17 },
    )
    put.mockResolvedValue({ id: 5, status: 'Cancelado' })
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Cancela o do Bruno{Enter}')

    expect(await screen.findByText('Bruno · Limpeza')).toBeInTheDocument()
    expect(screen.getByText('Cancelar o atendimento (o estoque dos itens volta)')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Feito. O atendimento foi atualizado.')).toBeInTheDocument()
    expect(put).toHaveBeenCalledWith('/api/atendimento/5', { status: 'Cancelado', dataAgendada: '2026-11-27T17:30:00Z', responsavelId: 4 })
  })

  it('proposta descartada não grava nada', async () => {
    post.mockResolvedValue({ resposta: 'Propus cancelar.', modelo: 'm', acoes: [PROPOSTA] })
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Cancela{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Descartar' }))

    expect(screen.getByText('Descartada. Nada mudou.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
  })

  it('proposta desatualizada avisa e não grava', async () => {
    post.mockResolvedValue({ resposta: 'Propus cancelar.', modelo: 'm', acoes: [PROPOSTA] })
    get.mockImplementation(async (url: string) =>
      url === '/api/atendimento/5'
        ? { id: 5, status: 'Concluido', dataAgendada: '2026-11-27T17:30:00Z', usuarioId: 4 }
        : { limite: 20, usadas: 3, restantes: 17 },
    )
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Cancela{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Este atendimento mudou depois da sugestão. Peça de novo ao Agente.')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
  })

  it('mostra a mensagem da API quando o Agente está indisponível', async () => {
    post.mockRejectedValue(new ApiError(503, 'O Agente ainda não está configurado neste servidor.'))
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), 'Oi{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('O Agente ainda não está configurado neste servidor.')
  })

  it('não envia pergunta vazia', async () => {
    const user = userEvent.setup()
    render(<AgentPanel period="mes" onClose={() => {}} />)

    await user.type(screen.getByLabelText('Pergunta para o Agente'), '   {Enter}')

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })
})
