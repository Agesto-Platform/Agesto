import type { PerfilUsuario } from '../types/api'

/** Contratos da área de superadmin (MicroERP.Api/DTOs/AdminDtos.cs). */

export interface AdminConta {
  id: number
  nome: string
  email: string
  ativo: boolean
  ultimoAcessoEm: string | null
  createdAt: string
}

export interface AdminAuthResponse {
  token: string
  expiresAt: string
  admin: AdminConta
}

export interface AdminCriarInput {
  nome: string
  email: string
  senha: string
}

export interface EmpresaAdminResumo {
  id: number
  nome: string
  documento: string | null
  ativa: boolean
  createdAt: string
  totalUsuarios: number
  usuariosAtivos: number
  donoNome: string | null
  donoEmail: string | null
  ultimoAcessoEm: string | null
}

export interface UsuarioAdminItem {
  id: number
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  deveTrocarSenha: boolean
  ultimoAcessoEm: string | null
  createdAt: string
}

export interface EmpresaAdminDetalhe {
  id: number
  nome: string
  documento: string | null
  ativa: boolean
  bloqueadaEm: string | null
  motivoBloqueio: string | null
  createdAt: string
  totalClientes: number
  totalAtendimentos: number
  ultimoAcessoEm: string | null
  usuarios: UsuarioAdminItem[]
}

export interface EmpresaAdminCriarInput {
  nomeEmpresa: string
  documento: string
  nomeDono: string
  emailDono: string
}

export interface EmpresaAdminCriada {
  empresaId: number
  emailDono: string
  senhaProvisoria: string
}

export interface SenhaProvisoriaAdmin {
  email: string
  senhaProvisoria: string
}

export interface AuditoriaAdminItem {
  id: number
  adminNome: string
  acao: string
  empresaId: number | null
  empresaNome: string | null
  usuarioId: number | null
  detalhes: string | null
  createdAt: string
}
