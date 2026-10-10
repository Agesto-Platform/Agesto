import { ApiError } from '@/lib/errors'
import type { AuthResponse } from '@/types/api'
import { seedCarga, seedAgenda } from './data'

export const DEMO_EMAIL = 'agente@agesto.app'
export const DEMO_SENHA = 'agesto123'

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
    if (b.email === DEMO_EMAIL && b.senha === DEMO_SENHA) {
      const res: AuthResponse = {
        token: buildMockJwt(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }
      return res as T
    }
    throw new ApiError(401, 'Credenciais inválidas.')
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
      atendimentos: { uuid: string }[]
    }
    return {
      clientesImportados: b.clientes.length,
      atendimentosImportados: b.atendimentos.length,
      clientesSincronizados: b.clientes.map((c) => c.uuid),
      atendimentosSincronizados: b.atendimentos.map((a) => a.uuid),
      clientesMapeados: b.clientes.map((c, i) => ({ uuid: c.uuid, id: 1000 + i })),
      erros: [],
      sincronizadoEm: new Date().toISOString(),
    } as T
  }

  throw new ApiError(404, `Sem mock para ${method} ${path}`)
}
