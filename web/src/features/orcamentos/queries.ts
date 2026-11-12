import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useListaPaginada } from '../../lib/paginacao'
import type { Orcamento, OrcamentoInput, OrcamentoResumo, StatusOrcamento } from '../../types/api'

const KEY = ['orcamento', 'list'] as const
const PATH = '/api/orcamento'

/** PAG-01 fase 3: 50 por vez, os mais recentes primeiro, com busca pelo cliente. */
export function useOrcamentosPaginados(filtros: { busca?: string; status?: StatusOrcamento }) {
  return useListaPaginada<Orcamento>(KEY, PATH, filtros)
}

/** Quantidade e valor por status, para o cartão do topo, sem baixar a lista. */
export function useOrcamentoResumo() {
  return useQuery({
    queryKey: [...KEY, 'resumo'],
    queryFn: () => api.get<OrcamentoResumo[]>(`${PATH}/resumo`),
  })
}

/** Um orçamento pelo id: para o recém-criado que ainda não está nas páginas carregadas. */
export function useOrcamento(id: number | null) {
  return useQuery({
    queryKey: [...KEY, 'detalhe', id],
    queryFn: () => api.get<Orcamento>(`${PATH}/${id}`),
    enabled: id !== null,
  })
}

export function useCreateOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: OrcamentoInput) => api.post<Orcamento>(PATH, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Backend: o update só altera o status (editar itens = novo orçamento). */
export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: StatusOrcamento }) =>
      api.put<Orcamento>(`${PATH}/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<null>(`${PATH}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Conversão em atendimento (exige status Aprovado). */
export function useConverterOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<{ id: number }>(`${PATH}/${id}/converter`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
