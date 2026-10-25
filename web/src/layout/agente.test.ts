import { afterEach, describe, it, expect } from 'vitest'
import { agenteAbreNa, lerEscolhaAgente, salvarEscolhaAgente } from './agente'

afterEach(() => localStorage.clear())

describe('agenteAbreNa', () => {
  it('sem escolha, abre em janela larga nas telas comuns', () => {
    expect(agenteAbreNa('/clientes', true, null)).toBe(true)
  })

  it('recolhido pelo usuário, continua fechado ao trocar de tela', () => {
    expect(agenteAbreNa('/', true, 'closed')).toBe(false)
    expect(agenteAbreNa('/clientes', true, 'closed')).toBe(false)
  })

  it('Agenda e Relatórios abrem fechados mesmo com o Agente aberto antes', () => {
    expect(agenteAbreNa('/agenda', true, 'open')).toBe(false)
    expect(agenteAbreNa('/relatorios', true, null)).toBe(false)
  })

  it('em janela estreita nunca abre sozinho', () => {
    expect(agenteAbreNa('/clientes', false, 'open')).toBe(false)
  })
})

describe('escolha do Agente', () => {
  it('começa sem escolha e lembra a última', () => {
    expect(lerEscolhaAgente()).toBeNull()
    salvarEscolhaAgente(false)
    expect(lerEscolhaAgente()).toBe('closed')
    salvarEscolhaAgente(true)
    expect(lerEscolhaAgente()).toBe('open')
  })

  it('ignora valor desconhecido salvo', () => {
    localStorage.setItem('agesto-agente', 'talvez')
    expect(lerEscolhaAgente()).toBeNull()
  })
})
