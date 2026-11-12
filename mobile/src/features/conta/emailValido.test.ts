import { describe, it, expect } from '@jest/globals'
import { emailValido } from './emailValido'

describe('emailValido', () => {
  it.each(['agente@agesto.app', '  agente@agesto.app  ', 'nome.sobrenome@empresa.com.br'])('aceita %s', (email) => {
    expect(emailValido(email)).toBe(true)
  })

  it.each(['', 'agente', 'agente@', 'agente@agesto', '@agesto.app', 'agente @agesto.app'])('recusa "%s"', (email) => {
    expect(emailValido(email)).toBe(false)
  })
})
