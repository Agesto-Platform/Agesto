import type { ItemOrcamento } from '../../types/api'

/** Rótulo legível de um item de orçamento (catálogo ou avulso). O nome vem no item (PAG-01). */
export function itemLabel(
  item: Pick<ItemOrcamento, 'produtoId' | 'servicoId' | 'descricao' | 'produtoNome' | 'servicoDescricao'>,
): string {
  if (item.produtoId != null) return item.produtoNome ?? item.descricao ?? `Produto #${item.produtoId}`
  if (item.servicoId != null) return item.servicoDescricao ?? item.descricao ?? `Serviço #${item.servicoId}`
  return item.descricao ?? 'Item avulso'
}

/** Número do orçamento como no template: "#0001". */
export function numero(id: number): string {
  return '#' + String(id).padStart(4, '0')
}
