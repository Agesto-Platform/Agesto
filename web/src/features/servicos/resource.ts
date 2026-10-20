import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { createResource } from '../../lib/resource'
import type { Servico, ServicoInput } from '../../types/api'

export const servicosResource = createResource<Servico, ServicoInput>(
  '/api/servico',
  'servico',
)

/** Dono confirma um serviço criado pelo agente sem precisar editar. */
export function useMarcarRevisado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Servico>(`/api/servico/${id}/revisar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['servico', 'list'] }),
  })
}

/** Quantos serviços criados por agentes ainda esperam revisão. */
export function aRevisar(servicos: Servico[] | undefined): Servico[] {
  return (servicos ?? []).filter((s) => !s.revisado)
}
