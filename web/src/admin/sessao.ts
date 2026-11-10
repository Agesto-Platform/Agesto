import { criarApi } from '../lib/api'
import { decodeJwt, isExpired } from '../auth/jwt'

/**
 * Sessão da área de superadmin (equipe do Agesto). Token guardado numa chave
 * própria: entrar como admin não mexe na sessão do painel do cliente e
 * vice-versa. O backend também separa os dois (audiência diferente no JWT).
 */
const KEY = 'agesto_admin_token'

export const getAdminToken = (): string | null => localStorage.getItem(KEY)
export const setAdminToken = (token: string): void => localStorage.setItem(KEY, token)
export const clearAdminToken = (): void => localStorage.removeItem(KEY)

export const adminApi = criarApi({ getToken: getAdminToken, clearToken: clearAdminToken, loginPath: '/admin/login' })

export interface AdminClaims {
  sub?: string
  email?: string
  name?: string
  escopo?: string
  exp?: number
}

/** Admin logado, ou null se não há token válido de plataforma. */
export function adminLogado(): AdminClaims | null {
  const token = getAdminToken()
  if (!token) return null
  const claims = decodeJwt(token) as AdminClaims | null
  if (!claims || isExpired(claims) || claims.escopo !== 'plataforma') {
    clearAdminToken()
    return null
  }
  return claims
}
