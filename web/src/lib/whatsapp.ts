/**
 * Links do WhatsApp (wa.me, DEC-56): abrem o WhatsApp de quem usa o Agesto com
 * a conversa do cliente e, opcionalmente, uma mensagem pronta. Nada passa pelo
 * servidor do Agesto, e a conversa continua no WhatsApp do próprio Dono.
 */

/**
 * Número no formato do wa.me (só dígitos, com o 55 do Brasil), ou null quando o
 * telefone não serve: aceita DDD + número (10 ou 11 dígitos) ou já com o 55.
 */
export function numeroWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null
  let d = telefone.replace(/\D/g, '')
  if (d.startsWith('0')) d = d.replace(/^0+/, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

/** Link wa.me para o telefone, com a mensagem opcional; null se o telefone não serve. */
export function linkWhatsApp(telefone: string | null | undefined, mensagem?: string): string | null {
  const numero = numeroWhatsApp(telefone)
  if (!numero) return null
  return mensagem ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : `https://wa.me/${numero}`
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
/** Intl usa espaço não separável depois do "R$"; no WhatsApp fica melhor o espaço comum. */
const reais = (v: number) => moeda.format(v).replace(/\s/g, ' ')

export interface LinhaOrcamento {
  descricao: string
  quantidade: number
  subtotal: number
}

/**
 * Mensagem do orçamento para o cliente: saudação, itens, total e fechamento.
 * Usa o nome inteiro: o cliente pode ser uma empresa ou um condomínio.
 */
export function mensagemOrcamento({
  clienteNome,
  numero,
  linhas,
  total,
}: {
  clienteNome: string
  numero: string
  linhas: LinhaOrcamento[]
  total: number
}): string {
  const itens = linhas.map((l) => {
    const qtd = l.quantidade === 1 ? '' : `${l.quantidade.toLocaleString('pt-BR')} × `
    return `• ${qtd}${l.descricao}: ${reais(l.subtotal)}`
  })
  return [
    `Olá${clienteNome.trim() ? ', ' + clienteNome.trim() : ''}! Segue o orçamento ${numero}:`,
    '',
    ...itens,
    '',
    `*Total: ${reais(total)}*`,
    '',
    'Qualquer dúvida, é só responder por aqui.',
  ].join('\n')
}
