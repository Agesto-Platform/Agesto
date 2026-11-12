import { describe, it, expect } from 'vitest'
import { agendaPeriod } from '../layout/PeriodSwitch'
import { periodRange, agendaRange } from './period'

// 15 de agosto de 2026, meio-dia (local)
const now = new Date(2026, 7, 15, 12, 0, 0)

describe('periodRange (janela analítica — termina em "agora")', () => {
  it('mês começa no dia 1 e termina em agora', () => {
    const { de, ate } = periodRange('mes', now)
    expect(new Date(de).getDate()).toBe(1)
    expect(ate).toBe(now.toISOString())
  })
  it('7 dias começa 6 dias antes', () => {
    const { de } = periodRange('7d', now)
    expect(new Date(de).getDate()).toBe(9)
  })
})

describe('agendaRange (janela pra frente — inclui o futuro)', () => {
  it('mês cobre do dia 1 ao último dia do mês', () => {
    const { de, ate } = agendaRange('mes', now)
    expect(new Date(de).getDate()).toBe(1)
    expect(new Date(ate).getMonth()).toBe(7) // agosto (0-based)
    expect(new Date(ate).getDate()).toBe(31)
  })
  it('7 dias vai de hoje até +7', () => {
    const { de, ate } = agendaRange('7d', now)
    expect(new Date(de).getDate()).toBe(15)
    expect(new Date(ate).getDate()).toBe(22)
  })
})

// PAG-02: a API limita a agenda a 62 dias; "Ano" do topo vira "Mês" na agenda.
describe('agendaPeriod', () => {
  it('troca ano por mês e mantém os outros', () => {
    expect(agendaPeriod('ano')).toBe('mes')
    expect(agendaPeriod('mes')).toBe('mes')
    expect(agendaPeriod('7d')).toBe('7d')
  })
  it('a janela do mês cabe nos 62 dias', () => {
    const { de, ate } = agendaRange(agendaPeriod('ano'), now)
    expect((new Date(ate).getTime() - new Date(de).getTime()) / 86_400_000).toBeLessThanOrEqual(62)
  })
})
