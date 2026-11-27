import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aplicarProposta, mudancas, PropostaDesatualizada } from './propostas'
import { api } from '../lib/api'
import type { AcaoAtendimento, Atendimento } from '../types/api'

vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/api')>()
  return { ...real, api: { get: vi.fn(), put: vi.fn() } }
})

const get = vi.mocked(api.get)
const put = vi.mocked(api.put)

const DATA_ATUAL = '2026-11-27T17:30:00Z'
const NOVA_DATA = '2026-11-29T12:00:00Z'

const proposta = (over: Partial<AcaoAtendimento> = {}): AcaoAtendimento => ({
  tipo: 'atendimento',
  clienteId: 10,
  clienteNome: 'Bruno',
  atendimentoId: 5,
  servico: 'Limpeza',
  dataAtual: DATA_ATUAL,
  responsavelAtualId: 4,
  responsavelAtualNome: 'João',
  novoStatus: null,
  novaData: null,
  novoResponsavelId: null,
  novoResponsavelNome: null,
  ...over,
})

const atendimento = (over: Partial<Atendimento> = {}) =>
  ({ id: 5, status: 'Pendente', dataAgendada: '2026-11-27T17:30:00.000Z', usuarioId: 4, ...over }) as Atendimento

describe('mudancas', () => {
  it('descreve cada mudança proposta', () => {
    expect(mudancas(proposta({ novoStatus: 'Cancelado' }))).toEqual(['Cancelar o atendimento (o estoque dos itens volta)'])
    expect(mudancas(proposta({ novoStatus: 'Concluido', novoResponsavelId: 5, novoResponsavelNome: 'Lia' }))).toEqual([
      'Concluir o atendimento',
      'Responsável: João → Lia',
    ])
    const [data] = mudancas(proposta({ novaData: NOVA_DATA }))
    expect(data).toMatch(/^Data: \d{2} nov\., \d{2}:\d{2} → \d{2} nov\., \d{2}:\d{2}$/)
  })
})

describe('aplicarProposta', () => {
  beforeEach(() => {
    get.mockReset()
    put.mockReset()
  })

  it('relê o atendimento e grava só o que muda, mantendo o resto', async () => {
    get.mockResolvedValue(atendimento())
    put.mockResolvedValue(atendimento({ dataAgendada: NOVA_DATA }))

    await aplicarProposta(proposta({ novaData: NOVA_DATA }))

    expect(get).toHaveBeenCalledWith('/api/atendimento/5')
    expect(put).toHaveBeenCalledWith('/api/atendimento/5', { status: 'Pendente', dataAgendada: NOVA_DATA, responsavelId: 4 })
  })

  it('concluir mantém a data atual', async () => {
    get.mockResolvedValue(atendimento())
    put.mockResolvedValue(atendimento({ status: 'Concluido' }))

    await aplicarProposta(proposta({ novoStatus: 'Concluido' }))

    expect(put).toHaveBeenCalledWith('/api/atendimento/5', {
      status: 'Concluido',
      dataAgendada: '2026-11-27T17:30:00.000Z',
      responsavelId: 4,
    })
  })

  it.each([
    ['já concluído', { status: 'Concluido' as const }],
    ['reagendado por outra pessoa', { dataAgendada: '2026-11-28T17:30:00Z' }],
    ['com outro responsável', { usuarioId: 9 }],
  ])('não grava se o atendimento mudou depois da proposta (%s)', async (_, mudou) => {
    get.mockResolvedValue(atendimento(mudou))

    await expect(aplicarProposta(proposta({ novoStatus: 'Cancelado' }))).rejects.toBeInstanceOf(PropostaDesatualizada)
    expect(put).not.toHaveBeenCalled()
  })
})
