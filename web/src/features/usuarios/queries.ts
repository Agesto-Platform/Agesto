import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { Usuario, UsuarioConvite, UsuarioCreateInput, UsuarioUpdateInput } from '../../types/api'

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
    // A pessoa recebe o convite por email e cria a senha (DEC-55).
    mutationFn: (body: UsuarioCreateInput) => api.post<UsuarioConvite>(PATH, body),
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

/** Reenvia o convite a quem ainda não criou a senha (o link anterior deixa de valer). */
export function useReenviarConvite() {
  const onSuccess = useInvalidate()
  return useMutation({
    mutationFn: (id: number) => api.post<UsuarioConvite>(`${PATH}/${id}/reenviar-convite`, {}),
    onSuccess,
  })
}

/** Texto do aviso depois de criar o acesso ou reenviar o convite. */
export function avisoDeConvite(r: UsuarioConvite): { ok: boolean; texto: string } {
  return r.envioHabilitado
    ? { ok: true, texto: `Convite enviado para ${r.usuario.email}. O link vale por 72 horas.` }
    : {
        ok: false,
        texto: `Acesso de ${r.usuario.nome} criado, mas o envio de email ainda não está configurado. Fale com o suporte do Agesto.`,
      }
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
