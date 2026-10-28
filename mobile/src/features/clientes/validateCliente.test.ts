import { describe, it, expect } from '@jest/globals'
import { validateCliente, isValid, cpfValido } from './validateCliente'

describe('validateCliente', () => {
  it('rejeita nome curto e CPF incompleto', () => {
    const e = validateCliente({ nome: 'A', cpf: '123' })
    expect(e.nome).toBeTruthy()
    expect(e.cpf).toBe('CPF deve ter 11 dígitos.')
    expect(isValid(e)).toBe(false)
  })

  it('aceita nome e CPF válidos (com ou sem máscara)', () => {
    expect(isValid(validateCliente({ nome: 'João Silva', cpf: '123.456.789-09' }))).toBe(true)
    expect(isValid(validateCliente({ nome: 'João Silva', cpf: '12345678909' }))).toBe(true)
  })

  it('rejeita CPF com 11 dígitos mas verificador errado', () => {
    expect(validateCliente({ nome: 'João Silva', cpf: '123.456.789-01' }).cpf).toBe('CPF inválido. Confira os números.')
  })
})

describe('cpfValido', () => {
  it.each(['123.456.789-09', '52998224725', '111.444.777-35', '000.000.001-91'])('aceita %s', (cpf) => {
    expect(cpfValido(cpf)).toBe(true)
  })

  it.each([
    ['verificador errado', '123.456.789-01'],
    ['segundo verificador errado', '529.982.247-24'],
    ['dígitos repetidos', '111.111.111-11'],
    ['zeros', '000.000.000-00'],
    ['curto', '1234567890'],
    ['vazio', ''],
  ])('recusa %s', (_, cpf) => {
    expect(cpfValido(cpf)).toBe(false)
  })
})
