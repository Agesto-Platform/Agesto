import { createResource } from '../../lib/resource'
import { useListaPaginada } from '../../lib/paginacao'
import type { Produto, ProdutoInput } from '../../types/api'

export const produtosResource = createResource<Produto, ProdutoInput>(
  '/api/produto',
  'produto',
)

/**
 * PAG-01 fase 3: a tela de Produtos, 50 por vez, com busca no servidor. `ids`
 * limita aos produtos dos alertas de estoque (filtro "Atenção"). Fica sob a chave
 * da lista: criar, editar e excluir recarregam as páginas.
 */
export function useProdutosPaginados(busca: string, ids?: number[], enabled = true) {
  return useListaPaginada<Produto>(
    ['produto', 'list'],
    '/api/produto',
    { busca: busca || undefined, ids: ids && ids.length > 0 ? ids.join(',') : undefined },
    enabled,
  )
}
