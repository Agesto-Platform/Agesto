import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useListaPaginada } from '../../lib/paginacao'
import type {
  Atendimento,
  AtendimentoContagem,
  AtendimentoInput,
  AtendimentoUpdate,
  ItemProdutoResp,
  ItemProdutoInput,
  ItemServicoResp,
  ItemServicoInput,
  StatusAtendimento,
} from '../../types/api'

const LIST = ['atendimento', 'list'] as const
const PATH = '/api/atendimento'

export function useAtendimentos() {
  return useQuery({ queryKey: LIST, queryFn: () => api.get<Atendimento[]>(PATH) })
}

/** PAG-01: lista paginada no servidor, com aba (status), busca e cliente. */
export function useAtendimentosPaginados(
  filtros: { status?: StatusAtendimento; busca?: string; clienteId?: number },
  enabled = true,
) {
  return useListaPaginada<Atendimento>(LIST, PATH, filtros, enabled)
}

/** Números das abas, sem baixar a lista inteira. Fica sob LIST: as mutações recarregam. */
export function useAtendimentoContagem() {
  return useQuery({
    queryKey: [...LIST, 'contagem'],
    queryFn: () => api.get<AtendimentoContagem>(`${PATH}/contagem`),
  })
}

/** Um atendimento pelo id: para o detalhe de um que não está nas páginas carregadas. */
export function useAtendimento(id: number | null) {
  return useQuery({
    queryKey: [...LIST, 'detalhe', id],
    queryFn: () => api.get<Atendimento>(`${PATH}/${id}`),
    enabled: id !== null,
  })
}

export function useCreateAtendimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AtendimentoInput) => api.post<Atendimento>(PATH, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST }),
  })
}

export function useUpdateAtendimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AtendimentoUpdate }) =>
      api.put<Atendimento>(`${PATH}/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST }),
  })
}

export function useDeleteAtendimento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<null>(`${PATH}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST }),
  })
}

/* ---- Itens (recalculam total/custo/margem e mexem em estoque) ---- */

export function useItemProdutos(atendimentoId: number) {
  return useQuery({
    queryKey: ['itemproduto', atendimentoId],
    queryFn: () => api.get<ItemProdutoResp[]>(`/api/itemproduto?atendimentoId=${atendimentoId}`),
    enabled: atendimentoId > 0,
  })
}

export function useItemServicos(atendimentoId: number) {
  return useQuery({
    queryKey: ['itemservico', atendimentoId],
    queryFn: () => api.get<ItemServicoResp[]>(`/api/itemservico?atendimentoId=${atendimentoId}`),
    enabled: atendimentoId > 0,
  })
}

/** Após mexer nos itens: atualiza itens, lista de atendimentos (totais) e estoque. */
function invalidateItens(qc: QueryClient, atId: number) {
  qc.invalidateQueries({ queryKey: ['itemproduto', atId] })
  qc.invalidateQueries({ queryKey: ['itemservico', atId] })
  qc.invalidateQueries({ queryKey: LIST })
  qc.invalidateQueries({ queryKey: ['produto', 'list'] })
}

export function useAddItemProduto(atId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ItemProdutoInput) => api.post<ItemProdutoResp>('/api/itemproduto', body),
    onSuccess: () => invalidateItens(qc, atId),
  })
}

export function useAddItemServico(atId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ItemServicoInput) => api.post<ItemServicoResp>('/api/itemservico', body),
    onSuccess: () => invalidateItens(qc, atId),
  })
}

export function useRemoveItemProduto(atId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<null>(`/api/itemproduto/${id}`),
    onSuccess: () => invalidateItens(qc, atId),
  })
}

export function useRemoveItemServico(atId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<null>(`/api/itemservico/${id}`),
    onSuccess: () => invalidateItens(qc, atId),
  })
}
