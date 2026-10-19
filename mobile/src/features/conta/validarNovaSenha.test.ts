import { describe, it, expect } from '@jest/globals'
import { validarNovaSenha } from './validarNovaSenha'

describe('validarNovaSenha', () => {
  it('aceita senha nova válida e confirmada', () => {
    expect(validarNovaSenha('provisoria1', 'MinhaSenha9', 'MinhaSenha9')).toBeNull()
  })

  it.each([
    ['', 'MinhaSenha9', 'MinhaSenha9', /provisória/],
    ['provisoria1', 'curta', 'curta', /mínimo 8/],
    ['provisoria1', 'MinhaSenha9', 'Outra12345', /confirmação/],
    ['provisoria1', 'provisoria1', 'provisoria1', /diferente/],
  ])('recusa (%s, %s, %s)', (atual, nova, confirma, msg) => {
    expect(validarNovaSenha(atual, nova, confirma)).toMatch(msg)
  })
})
