import { describe, it, expect } from 'vitest'
import { avisoAssinatura, dataBr, vencimentoTexto } from './assinatura'
import type { Assinatura } from '../types/api'

const base: Assinatura = {
  situacao: 'EmDia', pagoAte: '2026-12-12', diasParaVencer: 29, diasDeAtraso: null, diasParaBloqueio: null,
  licencasFuncionarios: 1, acessosEmUso: 2, acessosPermitidos: 2, valorMensal: 49.9, ativa: true, bloqueioAutomatico: false, pagamentos: [],
}

describe('avisoAssinatura (DEC-58)', () => {
  it('em dia ou sem cobrança, não avisa', () => {
    expect(avisoAssinatura(base)).toBeNull()
    expect(avisoAssinatura({ ...base, situacao: 'SemCobranca', pagoAte: null })).toBeNull()
  })

  it('vence em breve: aviso leve com a data', () => {
    expect(avisoAssinatura({ ...base, situacao: 'VenceEmBreve', diasParaVencer: 3, pagoAte: '2026-11-16' })).toEqual({
      texto: 'Sua assinatura vence em 3 dias, em 16/11/2026.',
      grave: false,
    })
    expect(avisoAssinatura({ ...base, situacao: 'VenceEmBreve', diasParaVencer: 0 })?.texto).toBe('Sua assinatura vence hoje.')
  })

  it('na carência: aviso grave com os dias até o bloqueio', () => {
    const aviso = avisoAssinatura({ ...base, situacao: 'EmCarencia', pagoAte: '2026-11-10', diasDeAtraso: 3, diasParaBloqueio: 8 })
    expect(aviso).toEqual({
      texto: 'Sua assinatura venceu em 10/11/2026. O acesso será bloqueado em 8 dias se o pagamento não for registrado.',
      grave: true,
    })
  })
})

describe('vencimentoTexto', () => {
  it('descreve o vencimento conforme a situação', () => {
    expect(vencimentoTexto(base)).toBe('Pago até 12/12/2026')
    expect(vencimentoTexto({ ...base, situacao: 'SemCobranca', pagoAte: null })).toBe('Sem pagamento registrado')
    expect(vencimentoTexto({ ...base, situacao: 'Atrasada', pagoAte: '2026-10-20', diasDeAtraso: 24 })).toBe('Venceu em 20/10/2026 (24 dias de atraso)')
  })

  it('dataBr não passa por fuso horário', () => {
    expect(dataBr('2026-01-01')).toBe('01/01/2026')
    expect(dataBr(null)).toBe('—')
  })
})
