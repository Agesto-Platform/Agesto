import { describe, it, expect, jest, afterEach } from '@jest/globals'
import { api } from '@/lib/api'
import { buscarHistorico, linhaDoServidor, montarLista, TAMANHO_HISTORICO, type LinhaAtendimento } from './historico'
import type { AgendaItem } from '@/types/api'

const doServidor = (uuid: string, data: Partial<AgendaItem> = {}): AgendaItem => ({
  id: 1, uuid, dataAgendada: null, dataRegistro: '2026-11-01T10:00:00Z', status: 'Concluido', valorTotal: 380,
  clienteId: 1, clienteNome: 'Marina', clienteTelefone: null, enderecoResumo: null, resumo: 'Manutenção',
  itens: [{ descricao: 'Manutenção', quantidade: 1, precoUnitario: 380, subtotal: 380 }],
  ...data,
})
const doAparelho = (key: string, data: string, pending: boolean): LinhaAtendimento => ({
  key, cliente: 'Vó Joana', data, itens: 1, status: 'Concluido', pending, motivo: null, resumo: null, valor: null,
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('montarLista', () => {
  it('sem o histórico do servidor mostra só o que está no aparelho, do mais recente', () => {
    const lista = montarLista(
      [doAparelho('a', '2026-11-01T10:00:00Z', false), doAparelho('b', '2026-11-03T10:00:00Z', true)],
      null,
    )
    expect(lista.map((l) => l.key)).toEqual(['b', 'a'])
  })

  it('com o histórico: não enviados primeiro, depois o servidor na ordem dele', () => {
    const lista = montarLista(
      [doAparelho('enviado', '2026-11-05T10:00:00Z', false), doAparelho('pendente', '2026-11-04T10:00:00Z', true)],
      [doServidor('enviado'), doServidor('outro-aparelho')],
    )
    // O enviado aparece uma vez só, com os dados do servidor.
    expect(lista.map((l) => [l.key, l.pending])).toEqual([
      ['pendente', true],
      ['enviado', false],
      ['outro-aparelho', false],
    ])
  })

  it('conclusão ainda não enviada vale a do aparelho, e página repetida não duplica', () => {
    const lista = montarLista(
      [doAparelho('at-9', '2026-11-05T10:00:00Z', true)],
      [doServidor('at-9', { status: 'Pendente' }), doServidor('x'), doServidor('x')],
    )
    expect(lista.map((l) => [l.key, l.status])).toEqual([
      ['at-9', 'Concluido'],
      ['x', 'Concluido'],
    ])
  })
})

describe('linhaDoServidor', () => {
  it('usa a data agendada, senão a de registro, e traz resumo e valor', () => {
    expect(linhaDoServidor(doServidor('a', { dataAgendada: '2026-11-02T09:00:00Z' }))).toMatchObject({
      data: '2026-11-02T09:00:00Z', resumo: 'Manutenção', valor: 380, itens: 1, pending: false,
    })
    expect(linhaDoServidor(doServidor('a')).data).toBe('2026-11-01T10:00:00Z')
    expect(linhaDoServidor(doServidor('a', { clienteNome: '' })).cliente).toBe('Cliente removido')
  })
})

describe('buscarHistorico', () => {
  it('pede a página certa da rota do histórico', async () => {
    const get = jest.spyOn(api, 'get')
    const pagina = await buscarHistorico(2)
    expect(get).toHaveBeenCalledWith(`/api/atendimento/historico?pagina=2&tamanho=${TAMANHO_HISTORICO}`)
    // No mock há 3 no histórico: a página 2 de 20 vem vazia, com o total.
    expect(pagina).toMatchObject({ itens: [], pagina: 2, total: 3 })
  })
})
