import { describe, it, expect } from 'vitest'
import { dataCurta, paraData } from './format'

// J-02: a receita por dia chega como dia puro ("2026-11-09"). Ler como UTC jogava
// o ponto para o dia anterior no Brasil.
describe('paraData', () => {
  it('dia puro vira meia-noite local, no mesmo dia', () => {
    const d = paraData('2026-11-09')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(10)
    expect(d.getDate()).toBe(9)
    expect(d.getHours()).toBe(0)
  })

  it('data com hora continua lida como instante', () => {
    expect(paraData('2026-11-09T15:00:00Z').getTime()).toBe(Date.UTC(2026, 10, 9, 15))
  })

  it('dataCurta de um dia puro mostra o próprio dia', () => {
    expect(dataCurta('2026-11-09')).toBe('09 nov.')
  })
})
