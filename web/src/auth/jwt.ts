/** Claims do JWT emitido pelo backend (AuthService.GenerateToken). */
export interface JwtClaims {
  sub?: string
  email?: string
  empresaId?: string
  perfil?: string
  exp?: number
}

/** Decodifica o payload do JWT (sem verificar assinatura — só leitura de claims). */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as JwtClaims
  } catch {
    return null
  }
}

/** Verdadeiro se o claim `exp` já passou. */
export function isExpired(claims: JwtClaims): boolean {
  return typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()
}

export const MSG_SO_DONO = 'Este painel é exclusivo do dono da empresa.'

/** Verdadeiro se o perfil do token é Dono (único com acesso ao painel). */
export function isDono(claims: JwtClaims): boolean {
  return claims.perfil === 'Dono'
}
