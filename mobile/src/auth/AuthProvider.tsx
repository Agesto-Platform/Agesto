import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { getToken, setToken, clearToken } from '@/lib/tokenStore'
import { setOnSessionExpired } from '@/lib/session'
import { db } from '@/db/instance'
import { initialSync } from '@/sync/sync'
import { ensureLocalOwner } from './localData'
import { AuthContext, type AuthValue } from './context'
import type { AuthResponse } from '@/types/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // 401 de sessão expirada (API real) limpa o estado de auth -> guarda redireciona.
    setOnSessionExpired(() => setTok(null))
    ;(async () => {
      await db.init()
      setTok(await getToken())
      setReady(true)
    })()
    return () => setOnSessionExpired(null)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, senha })
    // Outro usuário/empresa no mesmo aparelho: zera o banco local antes da Carga.
    await ensureLocalOwner(db, res.token)
    await setToken(res.token)
    // Popula o banco local ANTES de sinalizar autenticado (senão a guarda
    // navega pras abas com o banco ainda vazio). Offline: segue com o local.
    try {
      await initialSync()
    } catch {
      // sem rede: entra com o que já houver no device
    }
    setTok(res.token)
  }, [])

  const logout = useCallback(async () => {
    await clearToken()
    // Sair apaga os dados locais (a tela avisa antes se houver pendências).
    await db.reset()
    setTok(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ token, ready, login, logout }),
    [token, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
