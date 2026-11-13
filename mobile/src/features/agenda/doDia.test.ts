import { describe, it, expect } from '@jest/globals'
import { agendaDoDia } from './doDia'
import type { AgendaItem } from '@/types/api'

function item(id: number, dataAgendada: string | null): AgendaItem {
  return {
    id, uuid: `u${id}`, dataAgendada, status: 'Pendente', valorTotal: 0, clienteId: 1, clienteNome: 'Cliente',
    clienteTelefone: null, enderecoResumo: null, resumo: 'Serviço',
  } as AgendaItem
}

describe('agendaDoDia', () => {
  it('fica só com o dia de hoje, em ordem de horário', () => {
    const hoje = new Date(2026, 10, 13, 8, 0)
    const lista = [
      item(1, new Date(2026, 10, 13, 15, 0).toISOString()),
      item(2, new Date(2026, 10, 14, 9, 0).toISOString()),
      item(3, new Date(2026, 10, 13, 9, 30).toISOString()),
      item(4, new Date(2026, 10, 12, 18, 0).toISOString()),
      item(5, null),
    ]
    expect(agendaDoDia(lista, hoje).map((i) => i.id)).toEqual([3, 1])
  })
})
