import { describe, it, expect } from 'vitest'
import { coresPorResponsavel, diaInicial, diasComVisitas, pontosDoDia } from './mapa'
import type { AgendaItem } from '../../types/api'

const em = (dia: number, h: number) => new Date(2026, 9, dia, h).toISOString()

function item(id: number, data: string, local: [number, number] | null, usuarioId = 1): AgendaItem {
  return {
    id, uuid: `u${id}`, dataAgendada: data, status: 'Pendente', valorTotal: 0, usuarioId, clienteId: id,
    clienteNome: `Cliente ${id}`, clienteTelefone: null, enderecoResumo: null, resumo: 'Visita',
    latitude: local?.[0] ?? null, longitude: local?.[1] ?? null,
  }
}

describe('mapa da agenda', () => {
  it('numera as visitas do dia pelo horário e separa as sem localização', () => {
    const items = [item(1, em(17, 15), [-19.7, -47.9]), item(2, em(17, 9), null), item(3, em(17, 11), [-19.8, -47.9]), item(4, em(18, 9), [-19, -47])]
    const { pontos, semLocal } = pontosDoDia(items, '2026-10-17')
    expect(pontos.map((p) => [p.item.id, p.ordem])).toEqual([[3, 2], [1, 3]])
    expect(semLocal.map((i) => i.id)).toEqual([2])
  })

  it('abre em hoje, ou no próximo dia com visita', () => {
    const dias = diasComVisitas([item(1, em(20, 9), null), item(2, em(15, 9), null), item(3, em(20, 10), null)])
    expect(dias).toEqual(['2026-10-15', '2026-10-20'])
    expect(diaInicial(dias, new Date(2026, 9, 17, 12))).toBe('2026-10-20')
    expect(diaInicial(dias, new Date(2026, 9, 25, 12))).toBe('2026-10-20')
    expect(diaInicial([], new Date())).toBeNull()
  })

  it('dá uma cor fixa para cada responsável', () => {
    const cores = coresPorResponsavel([item(1, em(17, 9), null, 3), item(2, em(17, 9), null, 1), item(3, em(17, 9), null, 3)])
    expect([...cores.keys()]).toEqual([1, 3])
    expect(cores.get(1)).not.toBe(cores.get(3))
  })
})
