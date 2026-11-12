import { describe, it, expect } from 'vitest'
import { linkWhatsApp, mensagemOrcamento, numeroWhatsApp } from './whatsapp'

describe('numeroWhatsApp', () => {
  it('celular com máscara ganha o 55', () => {
    expect(numeroWhatsApp('(34) 99999-0000')).toBe('5534999990000')
  })
  it('fixo com 10 dígitos ganha o 55', () => {
    expect(numeroWhatsApp('34 3333-4444')).toBe('553433334444')
  })
  it('já com +55 fica como está', () => {
    expect(numeroWhatsApp('+55 34 99999-0000')).toBe('5534999990000')
  })
  it('zero do DDD à moda antiga é removido', () => {
    expect(numeroWhatsApp('034 99999-0000')).toBe('5534999990000')
  })
  it('vazio, curto demais ou longo demais não serve', () => {
    expect(numeroWhatsApp(null)).toBeNull()
    expect(numeroWhatsApp('')).toBeNull()
    expect(numeroWhatsApp('99999-0000')).toBeNull()
    expect(numeroWhatsApp('12345678901234')).toBeNull()
  })
})

describe('linkWhatsApp', () => {
  it('sem mensagem abre só a conversa', () => {
    expect(linkWhatsApp('(34) 99999-0000')).toBe('https://wa.me/5534999990000')
  })
  it('com mensagem codifica o texto', () => {
    expect(linkWhatsApp('(34) 99999-0000', 'Olá, tudo bem?\nTotal: R$ 10')).toBe(
      'https://wa.me/5534999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F%0ATotal%3A%20R%24%2010',
    )
  })
  it('telefone inválido não gera link', () => {
    expect(linkWhatsApp('123', 'oi')).toBeNull()
  })
})

describe('mensagemOrcamento', () => {
  it('monta saudação com o nome, itens e total', () => {
    const msg = mensagemOrcamento({
      clienteNome: 'Maria da Silva',
      numero: '#0007',
      linhas: [
        { descricao: 'Instalação de tomada', quantidade: 1, subtotal: 80 },
        { descricao: 'Cabo 2,5 mm', quantidade: 10, subtotal: 45.5 },
      ],
      total: 125.5,
    })
    expect(msg).toBe(
      [
        'Olá, Maria da Silva! Segue o orçamento #0007:',
        '',
        '• Instalação de tomada: R$ 80,00',
        '• 10 × Cabo 2,5 mm: R$ 45,50',
        '',
        '*Total: R$ 125,50*',
        '',
        'Qualquer dúvida, é só responder por aqui.',
      ].join('\n'),
    )
  })
})
