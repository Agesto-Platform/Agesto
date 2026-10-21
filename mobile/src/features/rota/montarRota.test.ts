import { describe, it, expect } from '@jest/globals'
import { MAX_PARADAS, montarRota, urlNavegacao, visitasDoDia } from './montarRota'
import type { AgendaItem } from '@/types/api'

const dia = new Date(2026, 9, 17)
const em = (h: number, m = 0, d = 17) => new Date(2026, 9, d, h, m).toISOString()

function visita(id: number, dataAgendada: string | null, endereco: string | null, status: AgendaItem['status'] = 'Pendente'): AgendaItem {
  return {
    id, uuid: `at-${id}`, dataAgendada, status, valorTotal: 0, clienteId: id, clienteNome: `Cliente ${id}`, clienteTelefone: null,
    enderecoResumo: null, enderecoCompleto: endereco, resumo: 'Visita',
  }
}

describe('montarRota', () => {
  it('pega só as pendentes do dia, na ordem dos horários', () => {
    const items = [
      visita(1, em(15), 'C'),
      visita(2, em(9), 'A'),
      visita(3, em(11), 'B', 'Concluido'),
      visita(4, em(10, 0, 18), 'Amanhã'),
      visita(5, null, 'Sem data'),
      visita(6, em(11, 30), 'B2'),
    ]
    expect(visitasDoDia(items, dia).map((v) => v.id)).toEqual([2, 6, 1])
  })

  it('monta a URL com a última visita como destino e as outras como paradas', () => {
    const rota = montarRota([visita(1, em(9), 'R. A, 1, Centro'), visita(2, em(11), 'Av. B, 2'), visita(3, em(15), 'R. C, 3')], dia)
    expect(rota.url).toBe(
      'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=R.%20C%2C%203' +
        '&waypoints=R.%20A%2C%201%2C%20Centro%7CAv.%20B%2C%202',
    )
    expect(rota.paradas.map((p) => p.id)).toEqual([1, 2, 3])
  })

  it('deixa de fora quem não tem endereço e avisa', () => {
    const rota = montarRota([visita(1, em(9), null), visita(2, em(10), 'R. A, 1')], dia)
    expect(rota.url).toBe(urlNavegacao('R. A, 1'))
    expect(rota.semEndereco.map((v) => v.id)).toEqual([1])
  })

  it('sem nenhum endereço não há rota', () => {
    expect(montarRota([visita(1, em(9), null)], dia).url).toBeNull()
  })

  it('respeita o limite de paradas do Google Maps', () => {
    const items = Array.from({ length: MAX_PARADAS + 2 }, (_, i) => visita(i + 1, em(7, i * 5), `Rua ${i + 1}`))
    const rota = montarRota(items, dia)
    expect(rota.paradas).toHaveLength(MAX_PARADAS)
    expect(rota.excedentes.map((v) => v.id)).toEqual([MAX_PARADAS + 1, MAX_PARADAS + 2])
  })
})
