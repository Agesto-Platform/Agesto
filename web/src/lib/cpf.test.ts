import { describe, it, expect } from 'vitest'
import { cpfValido } from './cpf'

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
