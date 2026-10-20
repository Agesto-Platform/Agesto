import { describe, it, expect } from '@jest/globals'
import { toItemAvulso, validateItemAvulso } from './itemAvulso'

describe('itemAvulso', () => {
  it('aceita descrição, quantidade e valor válidos', () => {
    const input = { descricao: '  Tubo de cobre 1/4 ', quantidade: '2', valor: '30,50' }
    expect(validateItemAvulso(input)).toEqual({})
    expect(toItemAvulso(input)).toEqual({ descricao: 'Tubo de cobre 1/4', quantidade: 2, precoUnitario: 30.5 })
  })

  it('aponta cada campo inválido', () => {
    expect(validateItemAvulso({ descricao: ' ', quantidade: '0', valor: 'abc' })).toEqual({
      descricao: 'Descreva o item avulso.',
      quantidade: 'Informe a quantidade.',
      valor: 'Informe um valor válido.',
    })
    expect(validateItemAvulso({ descricao: 'Fita', quantidade: '1,5', valor: '' }).quantidade).toBeDefined()
  })

  it('permite valor zero (item sem cobrança)', () => {
    expect(validateItemAvulso({ descricao: 'Brinde', quantidade: '1', valor: '0' })).toEqual({})
  })
})
