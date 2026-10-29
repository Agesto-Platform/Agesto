import { describe, it, expect } from '@jest/globals'
import { combinaBusca, normalizar } from './busca'

describe('normalizar', () => {
  it('tira acento e caixa', () => {
    expect(normalizar('Higienização de Split')).toBe('higienizacao de split')
  })
})

describe('combinaBusca', () => {
  it('busca vazia combina com tudo', () => {
    expect(combinaBusca('', 'Maria')).toBe(true)
    expect(combinaBusca('   ', 'Maria')).toBe(true)
  })

  it('acha sem acento, sem caixa e por pedaço da palavra', () => {
    expect(combinaBusca('higieniz', 'Higienização de split')).toBe(true)
    expect(combinaBusca('JOAO', 'João da Silva')).toBe(true)
  })

  it('cada palavra precisa aparecer, em qualquer ordem e em qualquer texto', () => {
    expect(combinaBusca('silva centro', 'João da Silva', 'Rua A, 10 — Centro')).toBe(true)
    expect(combinaBusca('silva bela vista', 'João da Silva', 'Centro')).toBe(false)
  })

  it('número compara só os dígitos', () => {
    expect(combinaBusca('99999', 'Maria', '(11) 99999-0000')).toBe(true)
    expect(combinaBusca('11 99999', 'Maria', '(11) 99999-0000')).toBe(true)
    expect(combinaBusca('123.456', 'Maria', '12345678909')).toBe(true)
    expect(combinaBusca('77777', 'Maria', '(11) 99999-0000')).toBe(false)
  })

  it('ignora textos ausentes', () => {
    expect(combinaBusca('maria', null, undefined, 'Maria')).toBe(true)
    expect(combinaBusca('maria', null)).toBe(false)
  })
})
