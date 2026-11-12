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

/** Texto que acompanha o PDF do orçamento. */
export function mensagemPdfOrcamento(clienteNome: string, numero: string): string {
  const nome = clienteNome.trim()
  return `Olá${nome ? ', ' + nome : ''}! Segue o orçamento ${numero} em PDF. Qualquer dúvida, é só responder por aqui.`
}

export type ResultadoEnvio = 'compartilhado' | 'cancelado' | 'baixado-com-conversa' | 'baixado'

/** Aparelho de toque que sabe compartilhar arquivo (celular, tablet). */
function podeCompartilhar(arquivo: File): boolean {
  return (
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [arquivo] }) &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

/** Baixa o arquivo pelo navegador. */
export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Envia o PDF pelo WhatsApp do jeito que o aparelho permite (DEC-56):
 * - celular: abre o compartilhar do sistema com o arquivo; a pessoa escolhe o WhatsApp e o contato;
 * - computador: baixa o PDF e abre a conversa do cliente no WhatsApp, para anexar o arquivo.
 * O wa.me não aceita anexo, por isso o computador fica em dois passos.
 */
export async function enviarPdfPorWhatsApp({
  pdf,
  nomeArquivo,
  telefone,
  texto,
}: {
  pdf: Blob
  nomeArquivo: string
  telefone: string | null | undefined
  texto: string
}): Promise<ResultadoEnvio> {
  const arquivo = new File([pdf], nomeArquivo, { type: 'application/pdf' })
  if (podeCompartilhar(arquivo)) {
    try {
      await navigator.share({ files: [arquivo], text: texto })
      return 'compartilhado'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Outro erro (ex.: permissão expirada): segue pelo download.
    }
  }
  baixarArquivo(pdf, nomeArquivo)
  const link = linkWhatsApp(telefone, texto)
  if (!link) return 'baixado'
  window.open(link, '_blank', 'noopener,noreferrer')
  return 'baixado-com-conversa'
}
