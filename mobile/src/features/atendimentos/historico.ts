import { api } from '@/lib/api'
import type { AgendaItem, PaginaResponse, StatusAtendimento } from '@/types/api'

export const TAMANHO_HISTORICO = 20

/** Uma linha da aba Atendimentos: registrada neste aparelho ou vinda do histórico do servidor. */
export interface LinhaAtendimento {
  /** Uuid do atendimento (o mesmo no aparelho e no servidor). */
  key: string
  cliente: string
  /** ISO da data que vale para ordenar e mostrar: a agendada, senão a de registro. */
  data: string
  itens: number
  status: StatusAtendimento
  /** Ainda não enviado: dá para corrigir ou excluir. */
  pending: boolean
  /** Por que o servidor não aceitou no último envio (I2); null se não recusou. */
  motivo: string | null
  /** Resumo e valor só vêm do servidor; null no que está só no aparelho. */
  resumo: string | null
  valor: number | null
}

/** Uma página do histórico: Agente vê os próprios, Dono vê os de todos (a API decide). */
export function buscarHistorico(pagina: number): Promise<PaginaResponse<AgendaItem>> {
  return api.get<PaginaResponse<AgendaItem>>(`/api/atendimento/historico?pagina=${pagina}&tamanho=${TAMANHO_HISTORICO}`)
}

export function linhaDoServidor(a: AgendaItem): LinhaAtendimento {
  return {
    key: a.uuid,
    cliente: a.clienteNome || 'Cliente removido',
    data: a.dataAgendada ?? a.dataRegistro ?? '',
    itens: a.itens?.length ?? 0,
    status: a.status,
    pending: false,
    motivo: null,
    resumo: a.resumo || null,
    valor: a.valorTotal,
  }
}

const quando = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
const maisRecentePrimeiro = (a: LinhaAtendimento, b: LinhaAtendimento) => quando(b.data) - quando(a.data)

/**
 * Junta o que está neste aparelho com o histórico do servidor.
 *
 * Sem histórico (sem internet ou API anterior a ele): só o que está no aparelho, como antes.
 * Com histórico: o que ainda não foi enviado vem primeiro, e o resto vem do servidor, que já
 * tem o que este aparelho enviou (o uuid é o mesmo) e o que foi feito em outro aparelho.
 */
export function montarLista(locais: LinhaAtendimento[], servidor: AgendaItem[] | null): LinhaAtendimento[] {
  if (servidor === null) return [...locais].sort(maisRecentePrimeiro)

  const naoEnviados = locais.filter((l) => l.pending).sort(maisRecentePrimeiro)
  const vistos = new Set(naoEnviados.map((l) => l.key))
  const doServidor: LinhaAtendimento[] = []
  for (const a of servidor) {
    // Conclusão ainda não enviada de um atendimento do servidor: vale a do aparelho.
    // Páginas podem se repetir quando entra um atendimento novo entre uma e outra.
    if (vistos.has(a.uuid)) continue
    vistos.add(a.uuid)
    doServidor.push(linhaDoServidor(a))
  }
  return [...naoEnviados, ...doServidor]
}
