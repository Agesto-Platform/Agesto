import type { Produto, Servico } from '../../types/api'

/** Rótulo legível de um item de orçamento (catálogo ou avulso). */
export function itemLabel(
  item: { produtoId: number | null; servicoId: number | null; descricao: string | null },
  produtos: Produto[],
  servicos: Servico[],
): string {
  if (item.produtoId != null)
    return produtos.find((p) => p.id === item.produtoId)?.nome ?? `Produto #${item.produtoId}`
  if (item.servicoId != null)
    return (
      servicos.find((s) => s.id === item.servicoId)?.descricao ?? `Serviço #${item.servicoId}`
    )
  return item.descricao ?? 'Item avulso'
}

/** Número do orçamento como no template: "#0001". */
export function numero(id: number): string {
  return '#' + String(id).padStart(4, '0')
}
