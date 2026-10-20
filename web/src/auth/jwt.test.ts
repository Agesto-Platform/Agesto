import { describe, expect, it } from 'vitest'
import { decodeJwt, isDono } from './jwt'

/** Monta um JWT fake (só o payload importa pro decode). */
function fakeToken(payload: object): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `x.${b64}.y`
}

describe('isDono', () => {
  it('aceita perfil Dono', () => {
    expect(isDono(decodeJwt(fakeToken({ perfil: 'Dono' }))!)).toBe(true)
  })

  it('recusa Agente ou token sem perfil', () => {
    expect(isDono(decodeJwt(fakeToken({ perfil: 'Agente' }))!)).toBe(false)
    expect(isDono(decodeJwt(fakeToken({ sub: '1' }))!)).toBe(false)
  })
})
