import { motivoDaRecusa, type Recusas } from '@/sync/sync'
import type { LocalAtendimento, PendingCliente } from '@/db/types'
import type { AgendaItem, Cliente, StatusAtendimento } from '@/types/api'

/** Uma linha da aba Atend. */
export interface Row {
  key: string
  cliente: string
  data: string
  itens: number
  status: StatusAtendimento
  /** Registrado no aparelho e ainda não aceito pelo servidor: dá para corrigir. */
  pending: boolean
  /** Por que o servidor não aceitou no último envio (I2); null se não recusou. */
  motivo: string | null
}

export function dataCurta(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${dia} · ${hora}`
}

/**
 * Junta o que foi registrado no aparelho com o histórico do servidor (Carga,
 * últimos 30 dias). O mesmo atendimento (mesmo uuid) aparece uma vez só, na
 * versão do aparelho, que é a que dá para corrigir enquanto não foi enviada.
 * Mais recentes primeiro.
 */
export function montarLinhas({
  locais,
  historico,
  clientes,
  clientesPendentes,
  recusas,
}: {
  locais: LocalAtendimento[]
  historico: AgendaItem[]
  clientes: Pick<Cliente, 'id' | 'nome'>[]
  clientesPendentes: Pick<PendingCliente, 'uuid' | 'nome'>[]
  recusas: Recusas
}): Row[] {
  const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]))
  const nomePorUuid = new Map(clientesPendentes.map((c) => [c.uuid, c.nome]))
  const doAparelho = new Set(locais.map((a) => a.uuid.toLowerCase()))

  const linhas: (Row & { quando: string })[] = [
    ...locais.map((a) => ({
      key: a.uuid,
      quando: a.dataRegistro,
      cliente:
        (a.clienteId !== null ? nomePorId.get(a.clienteId) : undefined) ??
        (a.clienteUuid ? nomePorUuid.get(a.clienteUuid) : undefined) ??
        `Cliente #${a.clienteId ?? 'novo'}`,
      data: dataCurta(a.dataRegistro),
      itens: a.itensProduto.length + a.itensServico.length,
      status: a.status,
      pending: a.syncedAt === null,
      motivo: a.syncedAt === null ? motivoDaRecusa(a, recusas) : null,
    })),
    ...historico
      .filter((h) => !doAparelho.has(h.uuid.toLowerCase()))
      .map((h) => {
        const quando = h.dataAgendada ?? h.dataRegistro ?? ''
        return {
          key: `s-${h.id}`,
          quando,
          cliente: h.clienteNome || nomePorId.get(h.clienteId) || `Cliente #${h.clienteId}`,
          data: quando ? dataCurta(quando) : '—',
          itens: h.itens?.length ?? 0,
          status: h.status,
          pending: false,
          motivo: null,
        }
      }),
  ]

  return linhas.sort((a, b) => b.quando.localeCompare(a.quando)).map(({ quando: _q, ...r }) => r)
}
