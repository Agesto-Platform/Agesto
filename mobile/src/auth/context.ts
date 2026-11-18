import { createContext } from 'react'
import type { Termos } from '@/types/api'

export interface AuthValue {
  token: string | null
  ready: boolean
  /** Entrou com senha provisória e ainda não trocou. */
  deveTrocarSenha: boolean
  /** Termos ainda não aceitos nesta versão (B6); null quando não há o que aceitar. */
  termos: Termos | null
  /**
   * Entra e roda a Carga. Se o aparelho tem pendências de outra conta, lança
   * PendenciasDeOutraContaError; repetir com `descartarPendencias` apaga e entra (MOB-01).
   */
  login: (email: string, senha: string, opcoes?: { descartarPendencias?: boolean }) => Promise<void>
  trocarSenha: (senhaAtual: string, novaSenha: string) => Promise<void>
  aceitarTermos: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
