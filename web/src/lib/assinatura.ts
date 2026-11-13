import type { BadgeTone } from '../components/ui'
import type { Assinatura, FormaPagamento, SituacaoAssinatura } from '../types/api'

/** Rótulo e cor da situação da assinatura (DEC-58). */
export const SITUACAO: Record<SituacaoAssinatura, { label: string; tone: BadgeTone }> = {
  SemCobranca: { label: 'Sem cobrança', tone: 'neutral' },
  EmDia: { label: 'Em dia', tone: 'ok' },
  VenceEmBreve: { label: 'Vence em breve', tone: 'warn' },
  EmCarencia: { label: 'Em carência', tone: 'warn' },
  Atrasada: { label: 'Atrasada', tone: 'neg' },
}

export const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'Pix', label: 'Pix' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Cartao', label: 'Cartão de crédito' },
  { value: 'Outro', label: 'Outro' },
]

export const rotuloForma = (f: FormaPagamento) => FORMAS.find((x) => x.value === f)?.label ?? f

/** "2026-12-12" → "12/12/2026", sem passar por fuso horário. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

/**
 * Aviso para o Dono no topo do painel, ou null quando não precisa (DEC-58):
 * perto de vencer, vencida hoje ou na carência dos 10 dias.
 */
export function avisoAssinatura(a: Assinatura): { texto: string; grave: boolean } | null {
  if (a.situacao === 'VenceEmBreve') {
    const n = a.diasParaVencer ?? 0
    return {
      texto: n === 0 ? 'Sua assinatura vence hoje.' : `Sua assinatura vence em ${dias(n)}, em ${dataBr(a.pagoAte)}.`,
      grave: false,
    }
  }
  if (a.situacao === 'EmCarencia') {
    const n = a.diasParaBloqueio ?? 0
    return {
      texto: `Sua assinatura venceu em ${dataBr(a.pagoAte)}. O acesso será bloqueado em ${dias(n)} se o pagamento não for registrado.`,
      grave: true,
    }
  }
  return null
}

/** Texto curto do vencimento para o superadmin e a Parametrização. */
export function vencimentoTexto(a: Pick<Assinatura, 'situacao' | 'pagoAte' | 'diasParaVencer' | 'diasDeAtraso'>): string {
  if (a.situacao === 'SemCobranca') return 'Sem pagamento registrado'
  if (a.diasDeAtraso) return `Venceu em ${dataBr(a.pagoAte)} (${dias(a.diasDeAtraso)} de atraso)`
  return `Pago até ${dataBr(a.pagoAte)}`
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (v: number) => moeda.format(v).replace(/\s/g, ' ')
