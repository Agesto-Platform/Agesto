import { http, HttpResponse } from 'msw'
import type { AuthResponse } from '../types/api'
import { ok, fail } from './lib/http'
import { dashboardMock } from './data/dashboard'
import { DEMO_EMAIL, DEMO_SENHA, DEMO_TERMOS_EMAIL, DEMO_TERMOS_VERSAO, buildMockJwt } from './data/auth'
import { clienteHandlers } from './data/clientes'
import { produtoHandlers } from './data/produtos'
import { servicoHandlers, servicoSugeridoHandlers } from './data/servicos'
import { agendaHandlers } from './data/agenda'
import { atendimentoHandlers } from './data/atendimentos'
import { orcamentoHandlers } from './data/orcamentos'
import { configuracaoHandlers } from './data/configuracao'
import { usuarioHandlers } from './data/usuarios'
import { agenteHandlers } from './data/agente'
import { adminHandlers } from './data/admin'
import { listasHandlers } from './data/listas'

/**
 * Handlers do MSW. O `*` casa com qualquer origem, então funciona
 * independentemente do VITE_API_BASE_URL.
 */
export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; senha?: string }
    const comTermos = body.email === DEMO_TERMOS_EMAIL
    if ((body.email === DEMO_EMAIL || comTermos) && body.senha === DEMO_SENHA) {
      const data: AuthResponse = {
        token: buildMockJwt(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        deveAceitarTermos: comTermos,
        termos: comTermos
          ? { versao: DEMO_TERMOS_VERSAO, urlTermos: `${location.origin}/termos`, urlPrivacidade: `${location.origin}/privacidade` }
          : null,
      }
      return HttpResponse.json(ok(data, 'Login realizado com sucesso.'))
    }
    return fail(401, 'Credenciais inválidas.')
  }),

  http.post('*/api/auth/aceitar-termos', async ({ request }) => {
    const body = (await request.json()) as { versao?: string }
    if (body.versao !== DEMO_TERMOS_VERSAO) return fail(409, 'Os termos mudaram. Entre de novo para ler a versão atual.')
    return HttpResponse.json(ok(null, 'Termos aceitos.'))
  }),

  // "Esqueci a senha" (DEC-54): sempre a mesma resposta; o link de demonstração é
  // /redefinir-senha#token=demo.
  http.post('*/api/auth/esqueci-senha', () =>
    HttpResponse.json(ok(null, 'Se o email for de um Dono cadastrado, enviamos um link para criar uma senha nova.')),
  ),
  http.post('*/api/auth/redefinir-senha', async ({ request }) => {
    const body = (await request.json()) as { token?: string }
    if (body.token !== 'demo') return fail(400, 'Link inválido ou expirado. Peça um novo em "Esqueci a senha".')
    return HttpResponse.json(ok({ perfil: 'Dono' }, 'Senha criada. Entre com a senha nova.'))
  }),

  http.get('*/api/app/versao', () =>
    HttpResponse.json(
      ok({ versaoMinimaAndroid: '1.0.0', urlDownload: 'https://expo.dev/artifacts/eas/agesto-demo.apk' }, 'Versão do app.'),
    ),
  ),

  http.get('*/api/metrics/dashboard', () =>
    HttpResponse.json(ok(dashboardMock, 'Dashboard consolidado.')),
  ),

  // Agenda (path mais específico antes do genérico de atendimento)
  ...agendaHandlers,
  // Listas paginadas, contagem e detalhe (PAG-01): sem paginação, seguem para os de baixo
  ...listasHandlers,
  ...atendimentoHandlers,

  // Cadastros (CRUD stateful)
  ...clienteHandlers,
  ...produtoHandlers,
  // Sugeridos antes do CRUD genérico de serviço (path mais específico)
  ...servicoSugeridoHandlers,
  ...servicoHandlers,
  ...orcamentoHandlers,
  ...configuracaoHandlers,
  ...usuarioHandlers,
  ...agenteHandlers,
  ...adminHandlers,
]
