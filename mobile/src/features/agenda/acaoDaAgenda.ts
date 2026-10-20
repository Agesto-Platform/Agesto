import type { LocalAtendimento } from '@/db/types'
import type { AgendaItem } from '@/types/api'

const ROTULO = { Concluido: 'Concluído', Pendente: 'Pendente', Cancelado: 'Cancelado' } as const

/**
 * O que um toque na visita da agenda faz: concluir no app, corrigir a conclusão
 * ainda não enviada ou nada (já finalizada no servidor). A etiqueta mostra o estado.
 */
export function acaoDaAgenda(
  item: AgendaItem,
  pendentes: LocalAtendimento[],
): { rota: `/registrar?${string}` | null; etiqueta: string | null } {
  const local = pendentes.find((a) => a.uuid === item.uuid && a.syncedAt === null)
  if (local) return { rota: `/registrar?editar=${item.uuid}`, etiqueta: `${ROTULO[local.status]} · não enviado` }
  if (item.status === 'Pendente') return { rota: `/registrar?concluir=${item.uuid}`, etiqueta: null }
  return { rota: null, etiqueta: ROTULO[item.status] }
}
