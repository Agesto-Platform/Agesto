import { http, HttpResponse } from 'msw'
import { ok, fail } from '../lib/http'
import type {
  AdminConta,
  AuditoriaAdminItem,
  EmpresaAdminDetalhe,
  EmpresaAdminResumo,
  UsuarioAdminItem,
} from '../../admin/types'

/** Área de superadmin no modo de demonstração (MSW): dados em memória. */
export const ADMIN_DEMO_EMAIL = 'equipe@agesto.app'
export const ADMIN_DEMO_SENHA = 'agesto-admin-123'

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenAdmin(): string {
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub: '1', email: ADMIN_DEMO_EMAIL, name: 'Equipe Agesto', escopo: 'plataforma', iat: now, exp: now + 8 * 3600 }
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.mocksignature`
}

const agora = () => new Date().toISOString()
const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

const admins: AdminConta[] = [
  { id: 1, nome: 'Equipe Agesto', email: ADMIN_DEMO_EMAIL, ativo: true, ultimoAcessoEm: agora(), createdAt: diasAtras(60) },
]

interface EmpresaMock extends Omit<EmpresaAdminDetalhe, 'usuarios'> {
  usuarios: UsuarioAdminItem[]
}

const usuario = (id: number, nome: string, email: string, perfil: 'Dono' | 'Agente', acesso: number | null): UsuarioAdminItem => ({
  id,
  nome,
  email,
  perfil,
  ativo: true,
  deveTrocarSenha: false,
  ultimoAcessoEm: acesso === null ? null : diasAtras(acesso),
  createdAt: diasAtras(40),
})

let empresas: EmpresaMock[] = [
  {
    id: 1, nome: 'AC Fernando Climatização', documento: '12.345.678/0001-90', ativa: true, bloqueadaEm: null, motivoBloqueio: null,
    createdAt: diasAtras(45), totalClientes: 86, totalAtendimentos: 412, ultimoAcessoEm: diasAtras(0),
    usuarios: [usuario(1, 'Fernando Lima', 'dono@agesto.app', 'Dono', 0), usuario(2, 'Carlos Souza', 'carlos@acfernando.com', 'Agente', 1)],
  },
  {
    id: 2, nome: 'Elétrica Boa Luz', documento: null, ativa: true, bloqueadaEm: null, motivoBloqueio: null,
    createdAt: diasAtras(12), totalClientes: 14, totalAtendimentos: 23, ultimoAcessoEm: diasAtras(3),
    usuarios: [usuario(3, 'Joana Prado', 'joana@boaluz.com', 'Dono', 3)],
  },
  {
    id: 3, nome: 'Hidráulica Rápida', documento: '98.765.432/0001-10', ativa: false, bloqueadaEm: diasAtras(2), motivoBloqueio: 'Mensalidade atrasada',
    createdAt: diasAtras(90), totalClientes: 40, totalAtendimentos: 150, ultimoAcessoEm: diasAtras(5),
    usuarios: [usuario(4, 'Marcos Reis', 'marcos@hrapida.com', 'Dono', 5)],
  },
]

let auditoria: AuditoriaAdminItem[] = [
  { id: 1, adminNome: 'Equipe Agesto', acao: 'bloquear-empresa', empresaId: 3, empresaNome: 'Hidráulica Rápida', usuarioId: null, detalhes: 'Mensalidade atrasada', createdAt: diasAtras(2) },
]

function auditar(acao: string, empresaId: number | null, detalhes: string | null = null, usuarioId: number | null = null) {
  const empresa = empresas.find((e) => e.id === empresaId)
  auditoria = [
    { id: auditoria.length + 1, adminNome: 'Equipe Agesto', acao, empresaId, empresaNome: empresa?.nome ?? null, usuarioId, detalhes, createdAt: agora() },
    ...auditoria,
  ]
}

const resumo = (e: EmpresaMock): EmpresaAdminResumo => {
  const dono = e.usuarios.find((u) => u.perfil === 'Dono')
  return {
    id: e.id, nome: e.nome, documento: e.documento, ativa: e.ativa, createdAt: e.createdAt,
    totalUsuarios: e.usuarios.length, usuariosAtivos: e.usuarios.filter((u) => u.ativo).length,
    donoNome: dono?.nome ?? null, donoEmail: dono?.email ?? null, ultimoAcessoEm: e.ultimoAcessoEm,
  }
}

const senhaProvisoria = () => Math.random().toString(36).slice(2, 12)
const autenticado = (request: Request) => request.headers.get('Authorization')?.startsWith('Bearer ') === true

export const adminHandlers = [
  http.post('*/api/admin/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; senha?: string }
    if (body.email !== ADMIN_DEMO_EMAIL || body.senha !== ADMIN_DEMO_SENHA) return fail(401, 'Credenciais inválidas.')
    return HttpResponse.json(ok({ token: tokenAdmin(), expiresAt: agora(), admin: admins[0] }, 'Login realizado com sucesso.'))
  }),

  http.get('*/api/admin/empresas', ({ request }) => {
    if (!autenticado(request)) return fail(401, 'Não autenticado.')
    const busca = (new URL(request.url).searchParams.get('busca') ?? '').toLowerCase()
    const lista = empresas
      .filter((e) => !busca || e.nome.toLowerCase().includes(busca) || e.usuarios.some((u) => u.email.includes(busca)))
      .map(resumo)
    return HttpResponse.json(ok(lista, 'Empresas.'))
  }),

  http.get('*/api/admin/empresas/:id', ({ params }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    return e ? HttpResponse.json(ok(e, 'Empresa.')) : fail(404, 'Empresa não encontrada.')
  }),

  http.post('*/api/admin/empresas', async ({ request }) => {
    const body = (await request.json()) as { nomeEmpresa: string; documento: string | null; nomeDono: string; emailDono: string }
    const email = body.emailDono.trim().toLowerCase()
    if (empresas.some((e) => e.usuarios.some((u) => u.email === email))) return fail(409, 'Email já cadastrado.')
    const id = Math.max(...empresas.map((e) => e.id)) + 1
    const dono = { ...usuario(id * 10, body.nomeDono, email, 'Dono', null), deveTrocarSenha: true }
    empresas = [
      { id, nome: body.nomeEmpresa, documento: body.documento, ativa: true, bloqueadaEm: null, motivoBloqueio: null, createdAt: agora(), totalClientes: 0, totalAtendimentos: 0, ultimoAcessoEm: null, usuarios: [dono] },
      ...empresas,
    ]
    auditar('criar-empresa', id, `Empresa "${body.nomeEmpresa}" com dono ${email}`, dono.id)
    return HttpResponse.json(ok({ empresaId: id, emailDono: email, senhaProvisoria: senhaProvisoria() }, 'Empresa criada.'))
  }),

  http.post('*/api/admin/empresas/:id/bloquear', async ({ params, request }) => {
    const { motivo } = (await request.json()) as { motivo: string }
    const e = empresas.find((x) => x.id === Number(params.id))
    if (!e) return fail(404, 'Empresa não encontrada.')
    Object.assign(e, { ativa: false, bloqueadaEm: agora(), motivoBloqueio: motivo })
    auditar('bloquear-empresa', e.id, motivo)
    return HttpResponse.json(ok(null, 'Empresa bloqueada.'))
  }),

  http.post('*/api/admin/empresas/:id/desbloquear', ({ params }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    if (!e) return fail(404, 'Empresa não encontrada.')
    Object.assign(e, { ativa: true, bloqueadaEm: null, motivoBloqueio: null })
    auditar('desbloquear-empresa', e.id)
    return HttpResponse.json(ok(null, 'Empresa desbloqueada.'))
  }),

  http.post('*/api/admin/empresas/:id/usuarios/:usuarioId/:acao', ({ params }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    const u = e?.usuarios.find((x) => x.id === Number(params.usuarioId))
    if (!e || !u) return fail(404, 'Usuário não encontrado nesta empresa.')
    if (params.acao === 'senha-provisoria') {
      u.deveTrocarSenha = true
      auditar('redefinir-senha', e.id, u.email, u.id)
      return HttpResponse.json(ok({ email: u.email, senhaProvisoria: senhaProvisoria() }, 'Senha provisória gerada.'))
    }
    u.ativo = params.acao === 'reativar'
    auditar(u.ativo ? 'reativar-usuario' : 'desativar-usuario', e.id, u.email, u.id)
    return HttpResponse.json(ok(null, u.ativo ? 'Usuário reativado.' : 'Usuário desativado.'))
  }),

  http.get('*/api/admin/auditoria', ({ request }) => {
    const empresaId = new URL(request.url).searchParams.get('empresaId')
    const lista = empresaId ? auditoria.filter((a) => a.empresaId === Number(empresaId)) : auditoria
    return HttpResponse.json(ok(lista, 'Auditoria.'))
  }),

  http.get('*/api/admin/equipe', () => HttpResponse.json(ok(admins, 'Equipe.'))),

  http.post('*/api/admin/equipe/:id/:acao', ({ params }) => {
    const alvo = admins.find((a) => a.id === Number(params.id))
    if (!alvo) return fail(404, 'Administrador não encontrado.')
    if (alvo.id === 1 && params.acao === 'desativar') return fail(409, 'Você não pode desativar o seu próprio acesso.')
    alvo.ativo = params.acao === 'reativar'
    auditar(alvo.ativo ? 'reativar-admin' : 'desativar-admin', null, alvo.email)
    return HttpResponse.json(ok(null, alvo.ativo ? 'Administrador reativado.' : 'Administrador desativado.'))
  }),

  http.post('*/api/admin/equipe', async ({ request }) => {
    const body = (await request.json()) as { nome: string; email: string }
    const novo: AdminConta = { id: admins.length + 1, nome: body.nome, email: body.email.toLowerCase(), ativo: true, ultimoAcessoEm: null, createdAt: agora() }
    admins.push(novo)
    auditar('criar-admin', null, `Novo admin: ${novo.email}`)
    return HttpResponse.json(ok(novo, 'Administrador criado.'))
  }),
]
