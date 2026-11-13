import { http, HttpResponse } from 'msw'
import { ok } from '../lib/http'
import type { Assinatura } from '../../types/api'

const diaRelativo = (dias: number) => {
  const d = new Date(Date.now() + dias * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Assinatura do Dono no modo de demonstração (DEC-58): vence em 3 dias, para mostrar o aviso. */
export const assinaturaHandlers = [
  http.get('*/api/assinatura', () => {
    const data: Assinatura = {
      situacao: 'VenceEmBreve',
      pagoAte: diaRelativo(3),
      diasParaVencer: 3,
      diasDeAtraso: null,
      diasParaBloqueio: null,
      licencasFuncionarios: 2,
      acessosEmUso: 3,
      acessosPermitidos: 3,
      valorMensal: 69.8,
      ativa: true,
      bloqueioAutomatico: false,
      pagamentos: [],
    }
    return HttpResponse.json(ok(data, 'Assinatura.'))
  }),
]
