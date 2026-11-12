import { describe, it, expect } from '@jest/globals'
import { linkWhatsApp, numeroWhatsApp } from './whatsapp'

describe('numeroWhatsApp', () => {
  it('celular com máscara ganha o 55', () => {
    expect(numeroWhatsApp('(34) 99999-0000')).toBe('5534999990000')
  })
  it('já com +55 fica como está', () => {
    expect(numeroWhatsApp('+55 34 3333-4444')).toBe('553433334444')
  })
  it('vazio ou incompleto não serve', () => {
    expect(numeroWhatsApp(null)).toBeNull()
    expect(numeroWhatsApp('99999-0000')).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('abre a conversa, com ou sem mensagem', () => {
    expect(linkWhatsApp('(34) 99999-0000')).toBe('https://wa.me/5534999990000')
    expect(linkWhatsApp('(34) 99999-0000', 'Olá!')).toBe('https://wa.me/5534999990000?text=Ol%C3%A1!')
  })
  it('telefone inválido não gera link', () => {
    expect(linkWhatsApp('123')).toBeNull()
  })
})
