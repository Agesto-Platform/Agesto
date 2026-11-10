import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from './sessao'
import type {
  AdminConta,
  AdminCriarInput,
  AuditoriaAdminItem,
  EmpresaAdminCriada,
  EmpresaAdminCriarInput,
  EmpresaAdminDetalhe,
  EmpresaAdminResumo,
  SenhaProvisoriaAdmin,
} from './types'

/** Tudo da área de superadmin fica sob ['admin', ...] no cache. */
const K = {
  empresas: (busca: string) => ['admin', 'empresas', busca] as const,
  empresa: (id: number) => ['admin', 'empresa', id] as const,
  auditoria: (empresaId?: number) => ['admin', 'auditoria', empresaId ?? 'todas'] as const,
  equipe: ['admin', 'equipe'] as const,
}

export function useEmpresasAdmin(busca: string) {
  const q = busca.trim()
  return useQuery({
    queryKey: K.empresas(q),
    queryFn: () => adminApi.get<EmpresaAdminResumo[]>(`/api/admin/empresas${q ? `?busca=${encodeURIComponent(q)}` : ''}`),
  })
}

export function useEmpresaAdmin(id: number) {
  return useQuery({
    queryKey: K.empresa(id),
    queryFn: () => adminApi.get<EmpresaAdminDetalhe>(`/api/admin/empresas/${id}`),
  })
}

export function useAuditoriaAdmin(empresaId?: number) {
  return useQuery({
    queryKey: K.auditoria(empresaId),
    queryFn: () => adminApi.get<AuditoriaAdminItem[]>(`/api/admin/auditoria${empresaId ? `?empresaId=${empresaId}` : ''}`),
  })
}

export function useEquipeAdmin() {
  return useQuery({ queryKey: K.equipe, queryFn: () => adminApi.get<AdminConta[]>('/api/admin/equipe') })
}

/** Depois de qualquer alteração, recarrega o que é de admin (listas, detalhe, auditoria). */
function useInvalidarAdmin() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin'] })
}

export function useCriarEmpresa() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: EmpresaAdminCriarInput) =>
      adminApi.post<EmpresaAdminCriada>('/api/admin/empresas', { ...input, documento: input.documento.trim() || null }),
    onSuccess: invalidar,
  })
}

export function useBloquearEmpresa(id: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (motivo: string) => adminApi.post<null>(`/api/admin/empresas/${id}/bloquear`, { motivo }),
    onSuccess: invalidar,
  })
}

export function useDesbloquearEmpresa(id: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: () => adminApi.post<null>(`/api/admin/empresas/${id}/desbloquear`, {}),
    onSuccess: invalidar,
  })
}

export function useAtivoUsuarioAdmin(empresaId: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: ({ usuarioId, ativo }: { usuarioId: number; ativo: boolean }) =>
      adminApi.post<null>(`/api/admin/empresas/${empresaId}/usuarios/${usuarioId}/${ativo ? 'reativar' : 'desativar'}`, {}),
    onSuccess: invalidar,
  })
}

export function useSenhaProvisoriaAdmin(empresaId: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (usuarioId: number) =>
      adminApi.post<SenhaProvisoriaAdmin>(`/api/admin/empresas/${empresaId}/usuarios/${usuarioId}/senha-provisoria`, {}),
    onSuccess: invalidar,
  })
}

export function useAtivoAdmin() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      adminApi.post<null>(`/api/admin/equipe/${id}/${ativo ? 'reativar' : 'desativar'}`, {}),
    onSuccess: invalidar,
  })
}

export function useCriarAdmin() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: AdminCriarInput) => adminApi.post<AdminConta>('/api/admin/equipe', input),
    onSuccess: invalidar,
  })
}
