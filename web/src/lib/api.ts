import { getToken, clearToken } from './token'
import type { ApiResponse } from '../types/api'

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** Erro de API com status HTTP e mensagens do envelope. */
export class ApiError extends Error {
  status: number
  errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/** De onde vem o token e para onde ir quando a sessão cai. */
interface Sessao {
  getToken: () => string | null
  clearToken: () => void
  loginPath: string
}

/**
 * Faz a chamada, injeta o Bearer, desembrulha o { success, data } e normaliza
 * erros. Em 401, limpa o token e redireciona pro login.
 */
async function apiFetch<T>(sessao: Sessao, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const token = sessao.getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  let body: ApiResponse<T> | null = null
  try {
    body = (await res.json()) as ApiResponse<T>
  } catch {
    body = null
  }

  // 401 com token = sessão expirada -> limpa e volta pro login.
  // No login não há token; ali 401 significa credenciais inválidas (mensagem do corpo).
  if (res.status === 401 && token) {
    sessao.clearToken()
    if (window.location.pathname !== sessao.loginPath) {
      window.location.assign(sessao.loginPath)
    }
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(
      res.status,
      body?.message ?? `Erro ${res.status}`,
      body?.errors ?? [],
    )
  }

  return body.data as T
}

/** Cliente da API para uma sessão (painel do cliente ou área de superadmin). */
export function criarApi(sessao: Sessao) {
  return {
    get: <T>(path: string) => apiFetch<T>(sessao, path),
    post: <T>(path: string, data: unknown) =>
      apiFetch<T>(sessao, path, { method: 'POST', body: JSON.stringify(data) }),
    put: <T>(path: string, data: unknown) =>
      apiFetch<T>(sessao, path, { method: 'PUT', body: JSON.stringify(data) }),
    del: <T>(path: string) => apiFetch<T>(sessao, path, { method: 'DELETE' }),
  }
}

export const api = criarApi({ getToken, clearToken, loginPath: '/login' })
