import { describe, it, expect } from '@jest/globals'
import { montarLinhas } from './historico'
import type { LocalAtendimento } from '@/db/types'
import type { AgendaItem } from '@/types/api'

const local = (uuid: string, dataRegistro: string, syncedAt: string | null): LocalAtendimento =>
  ({
    uuid, clienteId: 1, clienteUuid: null, status: 'Concluido', dataRegistro, dataAgendada: null,
    itensProduto: [], itensServico: [{ servicoId: 1, quantidade: 1 }], syncedAt,
  }) as unknown as LocalAtendimento

const doServidor = (id: number, uuid: string, quando: { agendada?: string; registro: string }): AgendaItem =>
  ({
    id, uuid, dataAgendada: quando.agendada ?? null, dataRegistro: quando.registro, status: 'Concluido', valorTotal: 100,
    clienteId: 2, clienteNome: 'Marina Alves', clienteTelefone: null, enderecoResumo: null, resumo: 'Serviço',
    itens: [{ descricao: 'Serviço', quantidade: 1, precoUnitario: 100, subtotal: 100 }],
  }) as AgendaItem

describe('montarLinhas', () => {
  it('junta aparelho e servidor sem repetir, mais recentes primeiro', () => {
    const linhas = montarLinhas({
      locais: [local('AAA', '2026-11-12T10:00:00.000Z', null), local('bbb', '2026-11-10T10:00:00.000Z', '2026-11-10T11:00:00.000Z')],
      historico: [
        doServidor(1, 'BBB', { registro: '2026-11-10T10:00:00.000Z' }), // o mesmo do aparelho (uuid sem diferença de maiúscula)
        doServidor(2, 'ccc', { agendada: '2026-11-11T14:00:00.000Z', registro: '2026-11-01T10:00:00.000Z' }),
      ],
      clientes: [{ id: 1, nome: 'Vó Joana' }],
      clientesPendentes: [],
      recusas: {},
    })

    expect(linhas.map((l) => l.key)).toEqual(['AAA', 's-2', 'bbb'])
    expect(linhas[0]).toMatchObject({ cliente: 'Vó Joana', pending: true })
    expect(linhas[1]).toMatchObject({ cliente: 'Marina Alves', pending: false, itens: 1, motivo: null })
  })

  it('sem nada no aparelho, mostra o histórico do servidor (celular novo)', () => {
    const linhas = montarLinhas({
      locais: [],
      historico: [doServidor(9, 'x', { registro: '2026-11-05T10:00:00.000Z' })],
      clientes: [],
      clientesPendentes: [],
      recusas: {},
    })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].pending).toBe(false)
  })
})
