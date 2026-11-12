import type { PerfilUsuario } from '../types/api'

/** Contratos da área de superadmin (MicroERP.Api/DTOs/AdminDtos.cs). */

export interface AdminConta {
  id: number
  nome: string
  email: string
  ativo: boolean
  /** Ainda não criou a senha pelo link do convite (DEC-55). */
  convitePendente?: boolean
  ultimoAcessoEm: string | null
  createdAt: string
}

export interface AdminAuthResponse {
  token: string
  expiresAt: string
  admin: AdminConta
}

/** Convite para a equipe: a pessoa cria a senha pelo link do email (DEC-55). */
export interface AdminConvidarInput {
  nome: string
  email: string
}

/** Convite ou link de senha enviado. envioHabilitado = false sem o Brevo configurado. */
export interface ConviteEnviado {
  email: string
  envioHabilitado: boolean
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
  /** Ainda não criou a senha pelo link do convite (DEC-55). */
  convitePendente?: boolean
  /** Bloqueio temporário por senhas erradas; criar a senha pelo link desbloqueia. */
  bloqueadoAte: string | null
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

/** O Dono recebe o convite por email (DEC-55). */
export interface EmpresaAdminCriada {
  empresaId: number
  emailDono: string
  envioHabilitado: boolean
}

/** Acesso novo numa empresa, criado pela equipe (DEC-55). */
export interface UsuarioAdminCriarInput {
  nome: string
  email: string
  perfil: PerfilUsuario
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
