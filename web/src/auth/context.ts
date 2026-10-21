import { createContext } from 'react'
import type { JwtClaims } from './jwt'

export interface AuthContextValue {
  user: JwtClaims | null
  isAuthenticated: boolean
  /** Entrou com senha provisória e ainda não trocou. */
  deveTrocarSenha: boolean
  login: (email: string, senha: string) => Promise<void>
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
