import { describe, it, expect, jest } from '@jest/globals'
import { renderHook, act } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { db } from '@/db/instance'
import {
  DEMO_EMAIL,
  DEMO_SENHA,
  DEMO_PRIMEIRO_ACESSO_EMAIL,
  DEMO_SENHA_PROVISORIA,
  DEMO_TERMOS_EMAIL,
  DEMO_TERMOS_VERSAO,
} from '@/mocks/handlers'

// No jest o preset resolve os adapters .native (SQLite/SecureStore): troca por memória.
jest.mock('@/db/instance', () => ({
  db: (jest.requireActual('@/db/memoryDb') as typeof import('@/db/memoryDb')).createMemoryDb(),
}))
jest.mock('@/lib/tokenStore', () => {
  let tok: string | null = null
  return {
    getToken: async () => tok,
    setToken: async (t: string) => {
      tok = t
    },
    clearToken: async () => {
      tok = null
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('AuthProvider (mock)', () => {
  it('logout apaga os dados locais do aparelho', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login(DEMO_EMAIL, DEMO_SENHA)
    })
    expect(result.current.token).toBeTruthy()
    expect((await db.getClientes()).length).toBeGreaterThan(0)
    expect(await db.getMeta('ownerSub')).toBe('2')

    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.token).toBeNull()
    expect(await db.getClientes()).toHaveLength(0)
    expect(await db.getMeta('lastSync')).toBeNull()
    expect(await db.getMeta('ownerSub')).toBeNull()
  })

  it('primeiro acesso com senha provisória exige troca até concluir', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login(DEMO_PRIMEIRO_ACESSO_EMAIL, DEMO_SENHA_PROVISORIA)
    })
    expect(result.current.token).toBeTruthy()
    expect(result.current.deveTrocarSenha).toBe(true)
    expect(await db.getMeta('deveTrocarSenha')).toBe('1')

    await act(async () => {
      await result.current.trocarSenha(DEMO_SENHA_PROVISORIA, 'MinhaSenha9')
    })
    expect(result.current.deveTrocarSenha).toBe(false)
    expect(await db.getMeta('deveTrocarSenha')).toBe('0')

    await act(async () => {
      await result.current.logout()
    })
  })

  it('termos não aceitos ficam pendentes até o aceite, inclusive ao reabrir', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login(DEMO_TERMOS_EMAIL, DEMO_SENHA)
    })
    expect(result.current.termos?.versao).toBe(DEMO_TERMOS_VERSAO)
    expect(JSON.parse((await db.getMeta('termosPendentes')) ?? 'null')?.versao).toBe(DEMO_TERMOS_VERSAO)

    // Reabrir o app lê a pendência do banco local.
    const reaberto = await renderHook(() => useAuth(), { wrapper })
    expect(reaberto.result.current.termos?.versao).toBe(DEMO_TERMOS_VERSAO)

    await act(async () => {
      await result.current.aceitarTermos()
    })
    expect(result.current.termos).toBeNull()
    expect(await db.getMeta('termosPendentes')).toBe('')

    await act(async () => {
      await result.current.logout()
    })
  })

  it('login sem termos pendentes não pede aceite', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login(DEMO_EMAIL, DEMO_SENHA)
    })
    expect(result.current.termos).toBeNull()

    await act(async () => {
      await result.current.logout()
    })
  })
})
