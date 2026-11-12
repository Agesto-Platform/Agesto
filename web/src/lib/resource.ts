import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

/**
 * Fábrica de hooks de mutação para um recurso REST no padrão do backend
 * (POST, PUT/{id}, DELETE/{id}). Invalida a chave da lista após cada mutação.
 * A lista em si é sempre paginada (PAG-01 fase 3): `useListaPaginada` e
 * `useBuscaRapida`, em lib/paginacao, ficam sob a mesma chave.
 */
export function createResource<TResp, TInput>(path: string, key: string) {
  const listKey = [key, 'list'] as const

  function useCreate() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (body: TInput) => api.post<TResp>(path, body),
      onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
    })
  }

  function useUpdate() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: ({ id, body }: { id: number; body: TInput }) =>
        api.put<TResp>(`${path}/${id}`, body),
      onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
    })
  }

  function useRemove() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id: number) => api.del<null>(`${path}/${id}`),
      onSuccess: () => qc.invalidateQueries({ queryKey: listKey }),
    })
  }

  return { useCreate, useUpdate, useRemove }
}
