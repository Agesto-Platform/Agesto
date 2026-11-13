import { http, HttpResponse } from 'msw'
import { ok, fail } from '../lib/http'
import type { Assinatura, PagamentoAssinatura } from '../../types/api'
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
/** Código da verificação em duas etapas no modo de demonstração (DEC-52). */
export const ADMIN_DEMO_CODIGO = '123456'

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

interface EmpresaMock extends Omit<EmpresaAdminDetalhe, 'usuarios' | 'assinatura'> {
  usuarios: UsuarioAdminItem[]
  // Assinatura (DEC-58): o mock guarda o essencial e calcula o resto.
  pagoAte: string | null
  licencas: number
  bloqueioAutomatico: boolean
  pagamentos: PagamentoAssinatura[]
}

const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diaRelativo = (dias: number) => isoDia(new Date(Date.now() + dias * 86_400_000))
const diffDias = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  const hoje = new Date()
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86_400_000)
}

/** Mesma regra da API (AssinaturaService.Calcular): 5 dias de aviso, 10 de carência. */
export function calcularAssinatura(pagoAte: string | null): Pick<Assinatura, 'situacao' | 'diasParaVencer' | 'diasDeAtraso' | 'diasParaBloqueio'> {
  if (!pagoAte) return { situacao: 'SemCobranca', diasParaVencer: null, diasDeAtraso: null, diasParaBloqueio: null }
  const restam = diffDias(pagoAte)
  if (restam >= 0) return { situacao: restam <= 5 ? 'VenceEmBreve' : 'EmDia', diasParaVencer: restam, diasDeAtraso: null, diasParaBloqueio: null }
  const atraso = -restam
  return atraso <= 10
    ? { situacao: 'EmCarencia', diasParaVencer: null, diasDeAtraso: atraso, diasParaBloqueio: 10 - atraso + 1 }
    : { situacao: 'Atrasada', diasParaVencer: null, diasDeAtraso: atraso, diasParaBloqueio: null }
}

const assinaturaDe = (e: EmpresaMock): Assinatura => ({
  ...calcularAssinatura(e.pagoAte),
  pagoAte: e.pagoAte,
  licencasFuncionarios: e.licencas,
  acessosEmUso: e.usuarios.filter((u) => u.ativo).length,
  acessosPermitidos: 1 + e.licencas,
  valorMensal: Math.round((49.9 + Math.max(0, e.licencas - 1) * 19.9) * 100) / 100,
  ativa: e.ativa,
  bloqueioAutomatico: e.bloqueioAutomatico,
  pagamentos: e.pagamentos,
})

const detalhe = (e: EmpresaMock): EmpresaAdminDetalhe => {
  const { pagoAte: _p, licencas: _l, bloqueioAutomatico: _b, pagamentos: _g, ...resto } = e
  return { ...resto, assinatura: assinaturaDe(e) }
}

const usuario = (id: number, nome: string, email: string, perfil: 'Dono' | 'Agente', acesso: number | null): UsuarioAdminItem => ({
  id,
  nome,
  email,
  perfil,
  ativo: true,
  deveTrocarSenha: false,
  bloqueadoAte: null,
  ultimoAcessoEm: acesso === null ? null : diasAtras(acesso),
  createdAt: diasAtras(40),
})

let empresas: EmpresaMock[] = [
  {
    id: 1, nome: 'AC Fernando Climatização', documento: '12.345.678/0001-90', ativa: true, bloqueadaEm: null, motivoBloqueio: null,
    createdAt: diasAtras(45), totalClientes: 86, totalAtendimentos: 412, ultimoAcessoEm: diasAtras(0),
    usuarios: [usuario(1, 'Fernando Lima', 'dono@agesto.app', 'Dono', 0), { ...usuario(2, 'Carlos Souza', 'carlos@acfernando.com', 'Agente', 1), bloqueadoAte: new Date(Date.now() + 12 * 60_000).toISOString() }],
    pagoAte: diaRelativo(3), licencas: 1, bloqueioAutomatico: false,
    pagamentos: [{ id: 1, valor: 49.9, pagoEm: diaRelativo(-27), forma: 'Pix', meses: 1, periodoInicio: diaRelativo(-27), periodoFim: diaRelativo(3), observacao: null, adminNome: 'Equipe Agesto', createdAt: diasAtras(27) }],
  },
  {
    id: 2, nome: 'Elétrica Boa Luz', documento: null, ativa: true, bloqueadaEm: null, motivoBloqueio: null,
    createdAt: diasAtras(12), totalClientes: 14, totalAtendimentos: 23, ultimoAcessoEm: diasAtras(3),
    usuarios: [usuario(3, 'Joana Prado', 'joana@boaluz.com', 'Dono', 3)],
    pagoAte: diaRelativo(-4), licencas: 2, bloqueioAutomatico: false, pagamentos: [],
  },
  {
    id: 3, nome: 'Hidráulica Rápida', documento: '98.765.432/0001-10', ativa: false, bloqueadaEm: diasAtras(2), motivoBloqueio: 'Mensalidade atrasada',
    createdAt: diasAtras(90), totalClientes: 40, totalAtendimentos: 150, ultimoAcessoEm: diasAtras(5),
    usuarios: [usuario(4, 'Marcos Reis', 'marcos@hrapida.com', 'Dono', 5)],
    pagoAte: diaRelativo(-15), licencas: 1, bloqueioAutomatico: true, pagamentos: [],
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
    pagoAte: e.pagoAte, licencasFuncionarios: e.licencas,
    situacaoAssinatura: calcularAssinatura(e.pagoAte).situacao,
    diasParaVencer: calcularAssinatura(e.pagoAte).diasParaVencer,
    diasDeAtraso: calcularAssinatura(e.pagoAte).diasDeAtraso,
  }
}

const autenticado = (request: Request) => request.headers.get('Authorization')?.startsWith('Bearer ') === true

export const adminHandlers = [
  // Duas etapas (DEC-52): a senha devolve um desafio; no modo de demonstração o código é 123456.
  http.post('*/api/admin/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; senha?: string }
    if (body.email !== ADMIN_DEMO_EMAIL || body.senha !== ADMIN_DEMO_SENHA) return fail(401, 'Credenciais inválidas.')
    return HttpResponse.json(
      ok({ token: '', expiresAt: agora(), admin: admins[0], exigeCodigo: true, desafio: 'demo', emailMascarado: 'eq***@agesto.app' }, 'Enviamos um código para o seu email.'),
    )
  }),

  http.post('*/api/admin/auth/login/codigo', async ({ request }) => {
    const body = (await request.json()) as { desafio?: string; codigo?: string }
    if (body.desafio !== 'demo' || body.codigo !== ADMIN_DEMO_CODIGO)
      return fail(401, 'Código inválido ou expirado. Confira o email ou entre de novo.')
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
    return e ? HttpResponse.json(ok(detalhe(e), 'Empresa.')) : fail(404, 'Empresa não encontrada.')
  }),

  // Assinatura (DEC-58): pagamento estende o "pago até" e tira o bloqueio automático.
  http.post('*/api/admin/empresas/:id/pagamentos', async ({ params, request }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    if (!e) return fail(404, 'Empresa não encontrada.')
    const body = (await request.json()) as { valor: number; pagoEm: string; forma: PagamentoAssinatura['forma']; meses: number; observacao: string | null }
    const inicio = e.pagoAte ? diaRelativo(diffDias(e.pagoAte) + 1) : diaRelativo(0)
    const [a, m, d] = inicio.split('-').map(Number)
    const fimData = new Date(a, m - 1 + body.meses, d - 1)
    const fim = isoDia(fimData)
    e.pagamentos = [{ id: Date.now(), valor: body.valor, pagoEm: body.pagoEm, forma: body.forma, meses: body.meses, periodoInicio: inicio, periodoFim: fim, observacao: body.observacao, adminNome: 'Equipe Agesto', createdAt: agora() }, ...e.pagamentos]
    e.pagoAte = fim
    if (!e.ativa && e.bloqueioAutomatico && calcularAssinatura(fim).situacao !== 'Atrasada') {
      e.ativa = true
      e.bloqueadaEm = null
      e.motivoBloqueio = null
      e.bloqueioAutomatico = false
    }
    auditar('registrar-pagamento', e.id, `R$ ${body.valor.toFixed(2)} (${body.forma}), pago até ${fim}`)
    return HttpResponse.json(ok(assinaturaDe(e), 'Pagamento registrado.'))
  }),

  http.put('*/api/admin/empresas/:id/assinatura', async ({ params, request }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    if (!e) return fail(404, 'Empresa não encontrada.')
    const body = (await request.json()) as { licencasFuncionarios: number; pagoAte: string | null }
    e.licencas = Math.max(1, body.licencasFuncionarios)
    e.pagoAte = body.pagoAte
    auditar('atualizar-assinatura', e.id, `${e.licencas} licença(s), pago até ${e.pagoAte ?? 'sem cobrança'}`)
    return HttpResponse.json(ok(assinaturaDe(e), 'Assinatura atualizada.'))
  }),

  http.post('*/api/admin/empresas', async ({ request }) => {
    const body = (await request.json()) as { nomeEmpresa: string; documento: string | null; nomeDono: string; emailDono: string }
    const email = body.emailDono.trim().toLowerCase()
    if (empresas.some((e) => e.usuarios.some((u) => u.email === email))) return fail(409, 'Email já cadastrado.')
    const id = Math.max(...empresas.map((e) => e.id)) + 1
    // O Dono recebe o convite por email para criar a senha (DEC-55).
    const dono = { ...usuario(id * 10, body.nomeDono, email, 'Dono', null), convitePendente: true }
    empresas = [
      { id, nome: body.nomeEmpresa, documento: body.documento, ativa: true, bloqueadaEm: null, motivoBloqueio: null, createdAt: agora(), totalClientes: 0, totalAtendimentos: 0, ultimoAcessoEm: null, usuarios: [dono], pagoAte: null, licencas: 1, bloqueioAutomatico: false, pagamentos: [] },
      ...empresas,
    ]
    auditar('criar-empresa', id, `Empresa "${body.nomeEmpresa}" com dono ${email}`, dono.id)
    return HttpResponse.json(ok({ empresaId: id, emailDono: email, envioHabilitado: true }, 'Empresa criada.'))
  }),

  // Acesso novo numa empresa, com convite por email (DEC-55).
  http.post('*/api/admin/empresas/:id/usuarios', async ({ params, request }) => {
    const e = empresas.find((x) => x.id === Number(params.id))
    if (!e) return fail(404, 'Empresa não encontrada.')
    const body = (await request.json()) as { nome: string; email: string; perfil: 'Dono' | 'Agente' }
    const email = body.email.trim().toLowerCase()
    if (empresas.some((x) => x.usuarios.some((u) => u.email === email))) return fail(409, 'Email já cadastrado.')
    if (e.usuarios.filter((u) => u.ativo).length >= 1 + e.licencas)
      return fail(409, 'A assinatura não tem licença livre. Aumente as licenças na assinatura antes de criar o acesso.')
    const id = Math.max(0, ...empresas.flatMap((x) => x.usuarios.map((u) => u.id))) + 1
    e.usuarios.push({ ...usuario(id, body.nome.trim(), email, body.perfil, null), convitePendente: true, createdAt: agora() })
    auditar('criar-usuario', e.id, `${email} (${body.perfil})`, id)
    return HttpResponse.json(ok({ email, envioHabilitado: true }, 'Acesso criado. Convite enviado.'))
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
    if (params.acao === 'enviar-link-senha') {
      if (!u.ativo) return fail(409, 'Reative o acesso antes de enviar o link de senha.')
      auditar(u.convitePendente ? 'reenviar-convite' : 'enviar-link-senha', e.id, u.email, u.id)
      return HttpResponse.json(ok({ email: u.email, envioHabilitado: true }, 'Link de senha enviado.'))
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
    if (params.acao === 'reenviar-convite') {
      if (!alvo.convitePendente) return fail(409, 'Este administrador já criou a senha.')
      auditar('reenviar-convite-admin', null, alvo.email)
      return HttpResponse.json(ok({ email: alvo.email, envioHabilitado: true }, 'Convite reenviado.'))
    }
    if (alvo.id === 1 && params.acao === 'desativar') return fail(409, 'Você não pode desativar o seu próprio acesso.')
    alvo.ativo = params.acao === 'reativar'
    auditar(alvo.ativo ? 'reativar-admin' : 'desativar-admin', null, alvo.email)
    return HttpResponse.json(ok(null, alvo.ativo ? 'Administrador reativado.' : 'Administrador desativado.'))
  }),

  http.post('*/api/admin/equipe', async ({ request }) => {
    const body = (await request.json()) as { nome: string; email: string }
    const email = body.email.trim().toLowerCase()
    if (admins.some((a) => a.email === email)) return fail(409, 'Email já cadastrado como administrador.')
    const novo: AdminConta = { id: admins.length + 1, nome: body.nome, email, ativo: true, convitePendente: true, ultimoAcessoEm: null, createdAt: agora() }
    admins.push(novo)
    auditar('convidar-admin', null, `Novo admin: ${novo.email}`)
    return HttpResponse.json(ok({ email, envioHabilitado: true }, 'Convite enviado.'))
  }),

  // Senha de quem foi convidado para a equipe; o token de demonstração é "demo".
  http.post('*/api/admin/auth/criar-senha', async ({ request }) => {
    const body = (await request.json()) as { token?: string }
    if (body.token !== 'demo') return fail(400, 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".')
    return HttpResponse.json(ok(null, 'Senha criada. Entre na área de administração.'))
  }),
]
