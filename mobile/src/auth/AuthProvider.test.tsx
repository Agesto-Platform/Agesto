import { describe, it, expect, jest } from '@jest/globals'
import { renderHook, act } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { PendenciasDeOutraContaError } from './localData'
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

  // MOB-01: a sessão de outra conta caiu (401, sem "Sair") e deixou pendências no aparelho.
  it('login de outra conta com pendências no aparelho não apaga nada sem confirmar', async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper })
    await db.setMeta('ownerSub', '99')
    await db.setMeta('ownerEmpresaId', '1')
    await db.setMeta('ownerEmail', 'outro@agente.local')
    await db.addAtendimento({
      uuid: 'pendente-1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-11-17T12:00:00Z',
      dataAgendada: null, itensProduto: [], itensServico: [], syncedAt: null,
    })

    let erro: unknown
    await act(async () => {
      await result.current.login(DEMO_EMAIL, DEMO_SENHA).catch((e: unknown) => (erro = e))
    })
    expect(erro).toBeInstanceOf(PendenciasDeOutraContaError)
    expect((erro as Error).message).toContain('outro@agente.local')
    expect(result.current.token).toBeNull()
    expect(await db.getPendingAtendimentos()).toHaveLength(1)

    // Confirmou: apaga as pendências da outra conta e entra.
    await act(async () => {
      await result.current.login(DEMO_EMAIL, DEMO_SENHA, { descartarPendencias: true })
    })
    expect(result.current.token).toBeTruthy()
    expect(await db.getPendingAtendimentos()).toHaveLength(0)
    expect(await db.getMeta('ownerSub')).toBe('2')

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
