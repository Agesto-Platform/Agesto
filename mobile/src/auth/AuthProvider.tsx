import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { getToken, setToken, clearToken } from '@/lib/tokenStore'
import { setOnSessionExpired } from '@/lib/session'
import { db } from '@/db/instance'
import { initialSync } from '@/sync/sync'
import { ensureLocalOwner } from './localData'
import { AuthContext, type AuthValue } from './context'
import type { AuthResponse, Termos } from '@/types/api'

// Pendências do login; vivem no banco local e somem no logout (db.reset).
const META_TROCA = 'deveTrocarSenha'
// JSON dos termos a aceitar (versão e links); vazio = nada a aceitar.
const META_TERMOS = 'termosPendentes'

function lerTermos(json: string | null): Termos | null {
  if (!json) return null
  try {
    return JSON.parse(json) as Termos
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [deveTrocarSenha, setDeve] = useState(false)
  const [termos, setTermos] = useState<Termos | null>(null)

  useEffect(() => {
    // 401 de sessão expirada (API real) limpa o estado de auth -> guarda redireciona.
    setOnSessionExpired(() => setTok(null))
    ;(async () => {
      await db.init()
      setDeve((await db.getMeta(META_TROCA)) === '1')
      setTermos(lerTermos(await db.getMeta(META_TERMOS)))
      setTok(await getToken())
      setReady(true)
    })()
    return () => setOnSessionExpired(null)
  }, [])

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, senha })
    // Outro usuário/empresa no mesmo aparelho: zera o banco local antes da Carga.
    await ensureLocalOwner(db, res.token)
    const deve = res.deveTrocarSenha === true
    await db.setMeta(META_TROCA, deve ? '1' : '0')
    setDeve(deve)
    const pendentes = res.deveAceitarTermos && res.termos ? res.termos : null
    await db.setMeta(META_TERMOS, pendentes ? JSON.stringify(pendentes) : '')
    setTermos(pendentes)
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

  const trocarSenha = useCallback(async (senhaAtual: string, novaSenha: string) => {
    await api.post<null>('/api/auth/trocar-senha', { senhaAtual, novaSenha })
    await db.setMeta(META_TROCA, '0')
    setDeve(false)
  }, [])

  const aceitarTermos = useCallback(async () => {
    if (!termos) return
    await api.post<null>('/api/auth/aceitar-termos', { versao: termos.versao })
    await db.setMeta(META_TERMOS, '')
    setTermos(null)
  }, [termos])

  const logout = useCallback(async () => {
    await clearToken()
    // Sair apaga os dados locais (a tela avisa antes se houver pendências).
    await db.reset()
    setDeve(false)
    setTermos(null)
    setTok(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({ token, ready, deveTrocarSenha, termos, login, trocarSenha, aceitarTermos, logout }),
    [token, ready, deveTrocarSenha, termos, login, trocarSenha, aceitarTermos, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
