import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { createResource } from '../../lib/resource'
import { useListaPaginada } from '../../lib/paginacao'
import type { Pagina, Servico, ServicoInput } from '../../types/api'

export const servicosResource = createResource<Servico, ServicoInput>(
  '/api/servico',
  'servico',
)

const LIST = ['servico', 'list'] as const

/**
 * PAG-01 fase 3: a tela de Serviços, 50 por vez, com busca no servidor.
 * `soARevisar` traz só os criados no app que esperam revisão do Dono.
 */
export function useServicosPaginados(busca: string, soARevisar: boolean) {
  return useListaPaginada<Servico>(LIST, '/api/servico', {
    busca: busca || undefined,
    revisado: soARevisar ? 'false' : undefined,
  })
}

/** Quantos serviços criados por agentes ainda esperam revisão (só o total, sem a lista). */
export function useServicosARevisarTotal() {
  return useQuery({
    queryKey: [...LIST, 'a-revisar'],
    queryFn: async () => (await api.get<Pagina<Servico>>('/api/servico?pagina=1&tamanho=1&revisado=false')).total,
  })
}

/** Dono confirma um serviço criado pelo agente sem precisar editar. */
export function useMarcarRevisado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Servico>(`/api/servico/${id}/revisar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST }),
  })
}
