import { uuid } from '@/lib/uuid'
import type { LocalAtendimento } from '@/db/types'
import type { ItemServicoSync, StatusAtendimento } from '@/types/api'
import type { ItemAvulso } from './itemAvulso'

export type QtyMap = Record<number, number>

/** Valor ajustado no atendimento (DEC-23), por id do catálogo. Ausente = preço do catálogo. */
export interface Precos {
  servico?: Record<number, number>
  produto?: Record<number, number>
}

export interface RegistroInput {
  /** Cliente da Carga (id do servidor) ou criado offline (clienteUuid). */
  clienteId: number | null
  clienteUuid?: string | null
  status: StatusAtendimento
  servicoQty: QtyMap
  produtoQty: QtyMap
  /** Serviços criados offline neste device, por uuid (resolvidos na Descarga). */
  servicoNovoQty?: Record<string, number>
  /** Itens fora do catálogo (produtoId null); não mexem no estoque. */
  avulsos?: ItemAvulso[]
  precos?: Precos
  /**
   * Serviços por empreitada (ids do catálogo e uuids dos criados offline). O
   * servidor não multiplica empreitada pela quantidade (DEC-04), então cada
   * unidade vai como uma linha.
   */
  empreitada?: { ids: number[]; uuids: string[] }
  /** Quando informado, o atendimento é agendado para essa data (futuro). */
  dataAgendada?: string | null
  /** Correção de um atendimento ainda não enviado: mantém uuid e data de registro. */
  uuid?: string
  dataRegistro?: string
  /** Conclusão de atendimento que já existe no servidor (uuid = o do servidor). */
  existente?: boolean
}

/** Verdadeiro se há ao menos um item (serviço, produto ou avulso) com quantidade > 0. */
export function hasItems(
  servicoQty: QtyMap,
  produtoQty: QtyMap,
  servicoNovoQty: Record<string, number> = {},
  avulsos: ItemAvulso[] = [],
): boolean {
  const any = (m: Record<string | number, number>) => Object.values(m).some((q) => q > 0)
  return any(servicoQty) || any(produtoQty) || any(servicoNovoQty) || avulsos.length > 0
}

/** Uma linha por unidade na empreitada; senão uma linha com a quantidade. */
function linhasServico(base: Omit<ItemServicoSync, 'uuid' | 'quantidade'>, q: number, empreitada: boolean): ItemServicoSync[] {
  if (!empreitada) return [{ uuid: uuid(), ...base, quantidade: q }]
  return Array.from({ length: q }, () => ({ uuid: uuid(), ...base, quantidade: 1 }))
}

/** Monta o atendimento offline (contrato enxuto: catálogo + quantidade). */
export function buildAtendimento(input: RegistroInput): LocalAtendimento {
  const toItens = (m: Record<string, number>) => Object.entries(m).filter(([, q]) => q > 0)
  const precoServico = input.precos?.servico ?? {}
  const precoProduto = input.precos?.produto ?? {}
  const empreitadaIds = new Set(input.empreitada?.ids ?? [])
  const empreitadaUuids = new Set(input.empreitada?.uuids ?? [])
  const comPreco = (p: number | undefined) => (p === undefined ? {} : { precoUnitario: p })

  return {
    uuid: input.uuid ?? uuid(),
    clienteId: input.clienteId,
    clienteUuid: input.clienteUuid ?? null,
    status: input.status,
    dataRegistro: input.dataRegistro ?? new Date().toISOString(),
    dataAgendada: input.dataAgendada ?? null,
    itensProduto: [
      ...toItens(input.produtoQty).map(([id, q]) => ({
        uuid: uuid(),
        produtoId: Number(id),
        ...comPreco(precoProduto[Number(id)]),
        quantidade: q,
      })),
      ...(input.avulsos ?? []).map((a) => ({
        uuid: uuid(),
        produtoId: null,
        descricao: a.descricao,
        precoUnitario: a.precoUnitario,
        quantidade: a.quantidade,
      })),
    ],
    itensServico: [
      ...toItens(input.servicoQty).flatMap(([id, q]) =>
        linhasServico({ servicoId: Number(id), ...comPreco(precoServico[Number(id)]) }, q, empreitadaIds.has(Number(id))),
      ),
      ...toItens(input.servicoNovoQty ?? {}).flatMap(([servicoUuid, q]) =>
        linhasServico({ servicoId: null, servicoUuid }, q, empreitadaUuids.has(servicoUuid)),
      ),
    ],
    ...(input.existente ? { existente: true } : {}),
    syncedAt: null,
  }
}

/** Estado da tela a partir de um atendimento salvo, para corrigir antes de enviar. */
export interface RegistroEstado {
  servicoQty: QtyMap
  produtoQty: QtyMap
  servicoNovoQty: Record<string, number>
  avulsos: ItemAvulso[]
  precos: Required<Precos>
}

export function estadoDoAtendimento(a: LocalAtendimento): RegistroEstado {
  const e: RegistroEstado = {
    servicoQty: {},
    produtoQty: {},
    servicoNovoQty: {},
    avulsos: [],
    precos: { servico: {}, produto: {} },
  }
  for (const it of a.itensProduto) {
    if (it.produtoId === null) {
      e.avulsos.push({ descricao: it.descricao ?? '', quantidade: it.quantidade, precoUnitario: it.precoUnitario ?? 0 })
      continue
    }
    e.produtoQty[it.produtoId] = (e.produtoQty[it.produtoId] ?? 0) + it.quantidade
    if (it.precoUnitario != null) e.precos.produto[it.produtoId] = it.precoUnitario
  }
  for (const it of a.itensServico) {
    if (it.servicoId === null) {
      // Serviço criado offline e ainda não religado ao id do servidor.
      if (it.servicoUuid) e.servicoNovoQty[it.servicoUuid] = (e.servicoNovoQty[it.servicoUuid] ?? 0) + it.quantidade
      continue
    }
    e.servicoQty[it.servicoId] = (e.servicoQty[it.servicoId] ?? 0) + it.quantidade
    if (it.precoUnitario != null) e.precos.servico[it.servicoId] = it.precoUnitario
  }
  return e
}
