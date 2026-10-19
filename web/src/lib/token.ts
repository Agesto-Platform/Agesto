/** Persistência do JWT (MVP em localStorage; ver nota de segurança no README). */
const KEY = 'agesto_token'

export const getToken = (): string | null => localStorage.getItem(KEY)
export const setToken = (token: string): void => localStorage.setItem(KEY, token)
export const clearToken = (): void => {
  localStorage.removeItem(KEY)
  localStorage.removeItem(KEY_TROCA)
}

// Pendência de troca de senha (senha provisória). Vive junto do token e some com ele.
const KEY_TROCA = 'agesto_deve_trocar_senha'

export const getDeveTrocarSenha = (): boolean => localStorage.getItem(KEY_TROCA) === '1'
export const setDeveTrocarSenha = (valor: boolean): void =>
  valor ? localStorage.setItem(KEY_TROCA, '1') : localStorage.removeItem(KEY_TROCA)
