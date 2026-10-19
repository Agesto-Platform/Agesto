import { describe, it, expect } from '@jest/globals'
import { parseValor, toServicoInput, validateServico } from './validateServico'

describe('validateServico', () => {
  it('aceita descrição e valor válidos', () => {
    expect(validateServico({ descricao: 'Limpeza de dreno', valor: '150' })).toEqual({})
  })

  it('rejeita descrição curta e valor vazio ou zero', () => {
    expect(validateServico({ descricao: ' x ', valor: '' })).toEqual({
      descricao: 'Descrição deve ter no mínimo 2 caracteres.',
      valor: 'Informe um valor válido.',
    })
    expect(validateServico({ descricao: 'Dreno', valor: '0' }).valor).toBeDefined()
  })

  it('entende valor no formato brasileiro', () => {
    expect(parseValor('150,50')).toBe(150.5)
    expect(parseValor('R$ 1.250,00')).toBe(1250)
    expect(parseValor('80.5')).toBe(80.5)
    expect(parseValor('abc')).toBeNull()
    expect(parseValor('1,234')).toBeNull()
  })

  it('preenche só o valor do tipo de cobrança escolhido', () => {
    expect(toServicoInput(' Dreno ', 'Empreitada', 120)).toEqual({
      descricao: 'Dreno', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 120,
    })
    expect(toServicoInput('Visita', 'PorHora', 90)).toMatchObject({ valorHora: 90, valorEmpreitada: null })
  })
})
