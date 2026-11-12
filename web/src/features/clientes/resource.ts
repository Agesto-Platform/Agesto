import { createResource } from '../../lib/resource'
import { useListaPaginada } from '../../lib/paginacao'
import type { Cliente, ClienteInput } from '../../types/api'

export const clientesResource = createResource<Cliente, ClienteInput>(
  '/api/cliente',
  'cliente',
)

/**
 * PAG-01: a tela de Clientes, 50 por vez, com a busca no servidor. Fica sob a chave
 * da lista (['cliente', 'list']): criar, editar e excluir recarregam as páginas.
 */
export function useClientesPaginados(busca: string) {
  return useListaPaginada<Cliente>(['cliente', 'list'], '/api/cliente', { busca: busca || undefined })
}
