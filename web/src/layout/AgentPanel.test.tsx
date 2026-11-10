import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentPanel } from './AgentPanel'
import { api, ApiError } from '../lib/api'

vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/api')>()
  return { ...real, api: { post: vi.fn() } }
})
vi.mock('./useConta', () => ({
  useConta: () => ({ nome: 'Davi', email: 'davi@exemplo.com', inicial: 'D', empresa: null }),
  saudacao: () => 'Boa tarde',
}))
vi.mock('../components/Mascote', () => ({ Mascote: () => null }))

const post = vi.mocked(api.post)

describe('AgentPanel', () => {
  beforeEach(() => {
    post.mockReset()
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
