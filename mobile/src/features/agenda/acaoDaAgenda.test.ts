import { describe, it, expect } from '@jest/globals'
import { acaoDaAgenda } from './acaoDaAgenda'
import type { LocalAtendimento } from '@/db/types'
import type { AgendaItem } from '@/types/api'

const item = (status: AgendaItem['status']): AgendaItem => ({
  id: 1, uuid: 'at-1', dataAgendada: null, status, valorTotal: 0, clienteId: 1, clienteNome: 'C',
  clienteTelefone: null, enderecoResumo: null, resumo: 'Visita',
})
const local = (syncedAt: string | null): LocalAtendimento => ({
  uuid: 'at-1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-20', dataAgendada: null,
  itensProduto: [], itensServico: [], existente: true, syncedAt,
})

describe('acaoDaAgenda', () => {
  it('visita pendente abre a conclusão', () => {
    expect(acaoDaAgenda(item('Pendente'), [])).toEqual({ rota: '/registrar?concluir=at-1', etiqueta: null })
  })

  it('conclusão ainda não enviada abre para corrigir', () => {
    expect(acaoDaAgenda(item('Pendente'), [local(null)])).toEqual({
      rota: '/registrar?editar=at-1',
      etiqueta: 'Concluído · não enviado',
    })
  })

  it('visita finalizada no servidor só mostra o estado', () => {
    expect(acaoDaAgenda(item('Concluido'), [local('2026-10-20T12:00:00Z')])).toEqual({ rota: null, etiqueta: 'Concluído' })
    expect(acaoDaAgenda(item('Cancelado'), [])).toEqual({ rota: null, etiqueta: 'Cancelado' })
  })
})
