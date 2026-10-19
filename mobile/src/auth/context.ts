import { createContext } from 'react'

export interface AuthValue {
  token: string | null
  ready: boolean
  /** Entrou com senha provisória e ainda não trocou. */
  deveTrocarSenha: boolean
  login: (email: string, senha: string) => Promise<void>
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
