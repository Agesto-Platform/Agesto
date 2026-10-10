import { describe, it, expect, jest } from '@jest/globals'
import { renderHook, act } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { db } from '@/db/instance'
import { DEMO_EMAIL, DEMO_SENHA } from '@/mocks/handlers'

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
})
