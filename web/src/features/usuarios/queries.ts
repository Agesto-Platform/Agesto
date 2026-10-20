import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type {
  Usuario,
  UsuarioCreateInput,
  UsuarioSenhaProvisoria,
  UsuarioUpdateInput,
} from '../../types/api'

const LIST = ['usuario', 'list'] as const
const PATH = '/api/usuario'

export function useUsuarios() {
  return useQuery({ queryKey: LIST, queryFn: () => api.get<Usuario[]>(PATH) })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: LIST })
}

export function useCreateUsuario() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: (body: UsuarioCreateInput) => api.post<UsuarioSenhaProvisoria>(PATH, body),
    onSuccess,
  })
}

export function useUpdateUsuario() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UsuarioUpdateInput }) =>
      api.put<Usuario>(`${PATH}/${id}`, body),
    onSuccess,
  })
}

export function useSetAtivoUsuario() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      api.post<Usuario>(`${PATH}/${id}/${ativo ? 'reativar' : 'desativar'}`, {}),
    onSuccess,
  })
}

export function useRedefinirSenha() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<UsuarioSenhaProvisoria>(`${PATH}/${id}/redefinir-senha`, {}),
    onSuccess,
  })
}

/** Usuários que podem receber atendimentos (ativos), agentes primeiro. */
export function responsaveis(usuarios: Usuario[] | undefined): Usuario[] {
  return (usuarios ?? [])
    .filter((u) => u.ativo)
    .sort((a, b) =>
      a.perfil === b.perfil ? a.nome.localeCompare(b.nome, 'pt-BR') : a.perfil === 'Agente' ? -1 : 1,
    )
}

/** Nome do responsável pelo id, com fallback legível. */
export function nomeUsuario(usuarios: Usuario[] | undefined, id: number): string {
  return usuarios?.find((u) => u.id === id)?.nome ?? `Usuário #${id}`
}
