import { createContext } from 'react'
import type { Termos } from '@/types/api'

export interface AuthValue {
  token: string | null
  ready: boolean
  /** Entrou com senha provisória e ainda não trocou. */
  deveTrocarSenha: boolean
  /** Termos ainda não aceitos nesta versão (B6); null quando não há o que aceitar. */
  termos: Termos | null
  login: (email: string, senha: string) => Promise<void>
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>
  aceitarTermos: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
