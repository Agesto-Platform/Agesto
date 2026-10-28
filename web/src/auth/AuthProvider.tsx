import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import {
  getToken,
  setToken,
  clearToken,
  getDeveTrocarSenha,
  setDeveTrocarSenha,
  getTermosPendentes,
  setTermosPendentes,
} from '../lib/token'
import { decodeJwt, isDono, isExpired, MSG_SO_DONO, type JwtClaims } from './jwt'
import { AuthContext, type AuthContextValue } from './context'
import type { AuthResponse, Termos, TrocarSenhaInput } from '../types/api'

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
  const [termos, setTermos] = useState<Termos | null>(() => (user !== null ? getTermosPendentes() : null))

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
    const pendentes = res.deveAceitarTermos && res.termos ? res.termos : null
    setTermosPendentes(pendentes)
    setTermos(pendentes)
    setUser(claims)
  }, [])

  const trocarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    const body: TrocarSenhaInput = { senhaAtual, novaSenha }
    await api.post<null>('/api/auth/trocar-senha', body)
    setDeveTrocarSenha(false)
    setDeve(false)
  }, [])

  // Aceita só a versão que a API mandou no login; se ela mudou, a API recusa e pede novo login.
  const aceitarTermos = useCallback(async () => {
    if (!termos) return
    await api.post<null>('/api/auth/aceitar-termos', { versao: termos.versao })
    setTermosPendentes(null)
    setTermos(null)
  }, [termos])

  const logout = useCallback(() => {
    clearToken()
    queryClient.clear()
    setDeve(false)
    setTermos(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      deveTrocarSenha,
      termos,
      login,
      trocarSenha,
      aceitarTermos,
      logout,
    }),
    [user, deveTrocarSenha, termos, login, trocarSenha, aceitarTermos, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
