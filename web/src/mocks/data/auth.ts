/** Credenciais de demonstração aceitas pelo mock de login. */
export const DEMO_EMAIL = 'dono@agesto.app'
export const DEMO_SENHA = 'agesto123'
/** Mesmo Dono, mas o login pede o aceite dos termos (B6). */
export const DEMO_TERMOS_EMAIL = 'termos@agesto.app'
export const DEMO_TERMOS_VERSAO = '2026-11'

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Monta um JWT "de mentira" (assinatura fake) com os mesmos claims do backend
 * — sub, email, empresaId, perfil, exp — para o decode do front funcionar igual.
 */
export function buildMockJwt(): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    sub: '1',
    email: DEMO_EMAIL,
    empresaId: '1',
    perfil: 'Dono',
    iat: now,
    exp: now + 2 * 60 * 60,
  }
  return `${b64url(header)}.${b64url(payload)}.mocksignature`
}
