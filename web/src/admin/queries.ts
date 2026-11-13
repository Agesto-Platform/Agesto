import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from './sessao'
import type {
  AdminConta,
  AdminConvidarInput,
  AuditoriaAdminItem,
  ConviteEnviado,
  EmpresaAdminCriada,
  EmpresaAdminCriarInput,
  EmpresaAdminDetalhe,
  EmpresaAdminResumo,
  AssinaturaAtualizarInput,
  PagamentoAssinaturaInput,
  UsuarioAdminCriarInput,
} from './types'
import type { Assinatura } from '../types/api'

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

/** Assinatura (DEC-58): registra um pagamento combinado no contato. */
export function useRegistrarPagamento(id: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: PagamentoAssinaturaInput) => adminApi.post<Assinatura>(`/api/admin/empresas/${id}/pagamentos`, input),
    onSuccess: invalidar,
  })
}

/** Assinatura (DEC-58): desfaz o último pagamento, registrado por engano. */
export function useDesfazerPagamento(id: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (pagamentoId: number) => adminApi.post<Assinatura>(`/api/admin/empresas/${id}/pagamentos/${pagamentoId}/desfazer`, {}),
    onSuccess: invalidar,
  })
}

/** Assinatura (DEC-58): licenças de funcionário e ajuste do "pago até". */
export function useAtualizarAssinatura(id: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: AssinaturaAtualizarInput) => adminApi.put<Assinatura>(`/api/admin/empresas/${id}/assinatura`, input),
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

/** Acesso novo numa empresa: a pessoa recebe o convite por email (DEC-55). */
export function useCriarUsuarioAdmin(empresaId: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: UsuarioAdminCriarInput) =>
      adminApi.post<ConviteEnviado>(`/api/admin/empresas/${empresaId}/usuarios`, input),
    onSuccess: invalidar,
  })
}

/** Reenvia o convite ou manda um link de senha nova (no lugar da senha provisória). */
export function useEnviarLinkSenhaAdmin(empresaId: number) {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (usuarioId: number) =>
      adminApi.post<ConviteEnviado>(`/api/admin/empresas/${empresaId}/usuarios/${usuarioId}/enviar-link-senha`, {}),
    onSuccess: invalidar,
  })
}

/** Texto do aviso depois de um convite ou link de senha. */
export function avisoDeEnvio(r: ConviteEnviado, oQue = 'Convite enviado'): { ok: boolean; texto: string } {
  return r.envioHabilitado
    ? { ok: true, texto: `${oQue} para ${r.email}. O link vale por 72 horas.` }
    : {
        ok: false,
        texto: `Registrado, mas o envio de email está desligado: configure o Brevo no Render (deploy/README.md, seção 11).`,
      }
}

export function useAtivoAdmin() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) =>
      adminApi.post<null>(`/api/admin/equipe/${id}/${ativo ? 'reativar' : 'desativar'}`, {}),
    onSuccess: invalidar,
  })
}

/** Convida alguém para a equipe: o email leva o link para criar a senha (DEC-55). */
export function useConvidarAdmin() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (input: AdminConvidarInput) => adminApi.post<ConviteEnviado>('/api/admin/equipe', input),
    onSuccess: invalidar,
  })
}

export function useReenviarConviteAdmin() {
  const invalidar = useInvalidarAdmin()
  return useMutation({
    mutationFn: (id: number) => adminApi.post<ConviteEnviado>(`/api/admin/equipe/${id}/reenviar-convite`, {}),
    onSuccess: invalidar,
  })
}
