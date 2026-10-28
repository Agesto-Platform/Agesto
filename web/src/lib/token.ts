import type { Termos } from '../types/api'

/** Persistência do JWT (MVP em localStorage; ver nota de segurança no README). */
const KEY = 'agesto_token'

export const getToken = (): string | null => localStorage.getItem(KEY)
export const setToken = (token: string): void => localStorage.setItem(KEY, token)
export const clearToken = (): void => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(KEY_TROCA)
  localStorage.removeItem(KEY_TERMOS)
}

// Pendência de troca de senha (senha provisória). Vive junto do token e some com ele.
const KEY_TROCA = 'agesto_deve_trocar_senha'

export const getDeveTrocarSenha = (): boolean => localStorage.getItem(KEY_TROCA) === '1'
export const setDeveTrocarSenha = (valor: boolean): void =>
  valor ? localStorage.setItem(KEY_TROCA, '1') : localStorage.removeItem(KEY_TROCA)

// Termos a aceitar (B6): versão e links, para a pendência sobreviver ao recarregar.
const KEY_TERMOS = 'agesto_termos_pendentes'

export function getTermosPendentes(): Termos | null {
  try {
    const json = localStorage.getItem(KEY_TERMOS)
    return json ? (JSON.parse(json) as Termos) : null
  } catch {
    return null
  }
}

export const setTermosPendentes = (termos: Termos | null): void =>
  termos ? localStorage.setItem(KEY_TERMOS, JSON.stringify(termos)) : localStorage.removeItem(KEY_TERMOS)
