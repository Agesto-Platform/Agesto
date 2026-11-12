/**
 * Links do WhatsApp (wa.me, DEC-56): abrem o WhatsApp do aparelho na conversa
 * com o cliente. Nada passa pelo servidor do Agesto. Mesma regra do web
 * (`web/src/lib/whatsapp.ts`).
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
