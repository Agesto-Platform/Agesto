import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { getToken, setToken, clearToken, getDeveTrocarSenha, setDeveTrocarSenha } from '../lib/token'
import { decodeJwt, isDono, isExpired, MSG_SO_DONO, type JwtClaims } from './jwt'
import { AuthContext, type AuthContextValue } from './context'
import type { AuthResponse, TrocarSenhaInput } from '../types/api'

/** Lê o token persistido no boot e descarta se inválido/expirado/não-Dono. */
function initialUser(): JwtClaims | null {
  const token = getToken()
  if (!token) return null
  const claims = decodeJwt(token)
  if (!claims || isExpired(claims) || !isDono(claims)) {
    clearToken()
    return null
  }
  return claims
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtClaims | null>(initialUser)
  const [deveTrocarSenha, setDeve] = useState<boolean>(() => user !== null && getDeveTrocarSenha())

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, senha })
    const claims = decodeJwt(res.token)
    // Painel é só do Dono: Agente (ou token sem perfil) não entra.
    if (!claims || !isDono(claims)) {
      clearToken()
      throw new ApiError(403, MSG_SO_DONO)
    }
    // Zera o cache para não reaproveitar dados de outro usuário.
    queryClient.clear()
    setToken(res.token)
    setDeveTrocarSenha(res.deveTrocarSenha === true)
    setDeve(res.deveTrocarSenha === true)
    setUser(claims)
  }, [])

  const trocarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const body: TrocarSenhaInput = { senhaAtual, novaSenha }
    await api.post<null>('/api/auth/trocar-senha', body)
    setDeveTrocarSenha(false)
    setDeve(false)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    queryClient.clear()
    setDeve(false)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, deveTrocarSenha, login, trocarSenha, logout }),
    [user, deveTrocarSenha, login, trocarSenha, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
