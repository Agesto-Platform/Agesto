import { ApiError } from '@/lib/errors'
import type { AuthResponse } from '@/types/api'
import { seedCarga, seedAgenda } from './data'

export const DEMO_EMAIL = 'agente@agesto.app'
export const DEMO_SENHA = 'agesto123'
/** Agente recém-cadastrado pelo Dono: entra com senha provisória e precisa trocar. */
export const DEMO_PRIMEIRO_ACESSO_EMAIL = 'novo@agesto.app'
export const DEMO_SENHA_PROVISORIA = 'provisoria1'
/** Agente que ainda não aceitou os termos de uso e a política de privacidade. */
export const DEMO_TERMOS_EMAIL = 'termos@agesto.app'
export const DEMO_TERMOS_VERSAO = '2026-11'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function b64url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const b64 =
    typeof btoa !== 'undefined'
      ? btoa(json)
      : Buffer.from(json, 'utf-8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** JWT "de mentira" com os mesmos claims do backend (perfil Agente). */
function buildMockJwt(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { sub: '2', email: DEMO_EMAIL, empresaId: '1', perfil: 'Agente', iat: now, exp: now + 2 * 60 * 60 }
  return `${b64url(header)}.${b64url(payload)}.mocksignature`
}

/**
 * Roteador de mock em código (sem MSW — funciona em native e web). Devolve o
 * `data` já desembrulhado, como o api.ts espera.
 */
export async function mockFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  await delay(150)

  if (method === 'POST' && path === '/api/auth/login') {
    const b = (body ?? {}) as { email?: string; senha?: string }
    const primeiroAcesso = b.email === DEMO_PRIMEIRO_ACESSO_EMAIL && b.senha === DEMO_SENHA_PROVISORIA
    const semTermos = b.email === DEMO_TERMOS_EMAIL && b.senha === DEMO_SENHA
    if ((b.email === DEMO_EMAIL && b.senha === DEMO_SENHA) || primeiroAcesso || semTermos) {
      const res: AuthResponse = {
        token: buildMockJwt(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        deveTrocarSenha: primeiroAcesso,
        deveAceitarTermos: semTermos,
        termos: semTermos
          ? { versao: DEMO_TERMOS_VERSAO, urlTermos: 'https://agesto.app/termos', urlPrivacidade: 'https://agesto.app/privacidade' }
          : null,
      }
      return res as T
    }
    throw new ApiError(401, 'Credenciais inválidas.')
  }

  if (method === 'POST' && path === '/api/auth/aceitar-termos') {
    const b = (body ?? {}) as { versao?: string }
    if (b.versao !== DEMO_TERMOS_VERSAO) {
      throw new ApiError(409, 'Os termos mudaram. Entre de novo para ler a versão atual.')
    }
    return null as T
  }

  if (method === 'POST' && path === '/api/auth/trocar-senha') {
    const b = (body ?? {}) as { senhaAtual?: string; novaSenha?: string }
    if (b.senhaAtual !== DEMO_SENHA_PROVISORIA && b.senhaAtual !== DEMO_SENHA) {
      throw new ApiError(400, 'Senha atual incorreta.')
    }
    return null as T
  }

  if (method === 'GET' && path.startsWith('/api/sync/carga')) {
    return seedCarga() as T
  }

  if (method === 'GET' && path.startsWith('/api/atendimento/agenda')) {
    return seedAgenda() as T
  }

  if (method === 'POST' && path.startsWith('/api/sync/descarga')) {
    const b = (body ?? { clientes: [], atendimentos: [] }) as {
      clientes: { uuid: string }[]
      servicos?: { uuid: string }[]
      atendimentos: { uuid: string }[]
      conclusoes?: { uuid: string }[]
    }
    const servicos = b.servicos ?? []
    const conclusoes = b.conclusoes ?? []
    return {
      clientesImportados: b.clientes.length,
      servicosImportados: servicos.length,
      servicosSincronizados: servicos.map((s) => s.uuid),
      servicosMapeados: servicos.map((s, i) => ({ uuid: s.uuid, id: 2000 + i })),
      atendimentosImportados: b.atendimentos.length,
      clientesSincronizados: b.clientes.map((c) => c.uuid),
      atendimentosSincronizados: b.atendimentos.map((a) => a.uuid),
      conclusoesImportadas: conclusoes.length,
      conclusoesSincronizadas: conclusoes.map((a) => a.uuid),
      clientesMapeados: b.clientes.map((c, i) => ({ uuid: c.uuid, id: 1000 + i })),
      erros: [],
      sincronizadoEm: new Date().toISOString(),
    } as T
  }

  throw new ApiError(404, `Sem mock para ${method} ${path}`)
}
