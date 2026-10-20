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
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json =
      typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf-8')
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}
