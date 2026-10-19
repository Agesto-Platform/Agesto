import { uuid } from '@/lib/uuid'
import type { LocalAtendimento } from '@/db/types'
import type { StatusAtendimento } from '@/types/api'

export type QtyMap = Record<number, number>

export interface RegistroInput {
  /** Cliente da Carga (id do servidor) ou criado offline (clienteUuid). */
  clienteId: number | null
  clienteUuid?: string | null
  status: StatusAtendimento
  servicoQty: QtyMap
  produtoQty: QtyMap
  /** Serviços criados offline neste device, por uuid (resolvidos na Descarga). */
  servicoNovoQty?: Record<string, number>
  /** Quando informado, o atendimento é agendado para essa data (futuro). */
  dataAgendada?: string | null
}

/** Verdadeiro se há ao menos um item (serviço ou produto) com quantidade > 0. */
export function hasItems(servicoQty: QtyMap, produtoQty: QtyMap, servicoNovoQty: Record<string, number> = {}): boolean {
  const any = (m: Record<string | number, number>) => Object.values(m).some((q) => q > 0)
  return any(servicoQty) || any(produtoQty) || any(servicoNovoQty)
}

/** Monta o atendimento offline (contrato enxuto: catálogo + quantidade). */
export function buildAtendimento(input: RegistroInput): LocalAtendimento {
  const toItens = (m: QtyMap) =>
    Object.entries(m)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => ({ id: Number(id), quantidade: q }))

  return {
    uuid: uuid(),
    clienteId: input.clienteId,
    clienteUuid: input.clienteUuid ?? null,
    status: input.status,
    dataRegistro: new Date().toISOString(),
    dataAgendada: input.dataAgendada ?? null,
    itensProduto: toItens(input.produtoQty).map((x) => ({ produtoId: x.id, quantidade: x.quantidade })),
    itensServico: [
      ...toItens(input.servicoQty).map((x) => ({ servicoId: x.id, quantidade: x.quantidade })),
      ...Object.entries(input.servicoNovoQty ?? {})
        .filter(([, q]) => q > 0)
        .map(([servicoUuid, q]) => ({ servicoId: null, servicoUuid, quantidade: q })),
    ],
    syncedAt: null,
  }
}
