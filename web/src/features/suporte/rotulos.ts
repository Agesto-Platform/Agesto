import type { BadgeTone } from '../../components/ui'
import type { AssuntoTicket, StatusTicket } from '../../types/api'

/** Assuntos que o Dono escolhe ao abrir um chamado (DEC-60). */
export const ASSUNTOS: { value: AssuntoTicket; label: string }[] = [
  { value: 'Duvida', label: 'Dúvida' },
  { value: 'Bug', label: 'Problema (bug)' },
  { value: 'Melhoria', label: 'Sugestão de melhoria' },
  { value: 'Assinatura', label: 'Assinatura e pagamento' },
  { value: 'Outro', label: 'Outro assunto' },
]

export const STATUS: { value: StatusTicket; label: string; tone: BadgeTone }[] = [
  { value: 'Aberto', label: 'Aberto', tone: 'warn' },
  { value: 'EmAndamento', label: 'Em andamento', tone: 'info' },
  { value: 'Resolvido', label: 'Resolvido', tone: 'ok' },
]

export const rotuloAssunto = (a: AssuntoTicket) => ASSUNTOS.find((x) => x.value === a)?.label ?? a

export const statusInfo = (s: StatusTicket) => STATUS.find((x) => x.value === s) ?? STATUS[0]

/** Mesmo limite da API (DEC-60). */
export const MENSAGEM_MIN = 10
export const MENSAGEM_MAX = 4000
