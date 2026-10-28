import { describe, it, expect, jest } from '@jest/globals'
import { renderHook } from '@testing-library/react-native'
import * as sync from './sync'
import { INTERVALO_MINIMO_MS, deveSincronizar, sincronizarUmaVez, ultimaSincronizacao, useAoSincronizar } from './automatica'
import { createMemoryDb } from '@/db/memoryDb'

jest.mock('@/db/instance', () => ({
  db: (jest.requireActual('@/db/memoryDb') as typeof import('@/db/memoryDb')).createMemoryDb(),
}))

const resultado: sync.SincronizacaoResult = {
  enviado: { clientesImportados: 0, servicosImportados: 0, atendimentosImportados: 0, conclusoesImportadas: 0, erros: [] },
  recebido: { clientes: 0, produtos: 0, servicos: 0, agenda: 0 },
}

describe('deveSincronizar', () => {
  const recente = INTERVALO_MINIMO_MS - 1

  it('com pendência envia logo, mesmo logo depois da última', () => {
    expect(deveSincronizar({ pendentes: 1, msDesdeUltima: 0, tela: 'index' })).toBe(true)
  })

  it('sem pendência só baixa de novo depois do intervalo', () => {
    expect(deveSincronizar({ pendentes: 0, msDesdeUltima: recente, tela: undefined })).toBe(false)
    expect(deveSincronizar({ pendentes: 0, msDesdeUltima: INTERVALO_MINIMO_MS, tela: undefined })).toBe(true)
  })

  it('relógio do aparelho muito atrasado conta como sincronização antiga', () => {
    expect(deveSincronizar({ pendentes: 0, msDesdeUltima: -60_000, tela: undefined })).toBe(false)
    expect(deveSincronizar({ pendentes: 0, msDesdeUltima: -2 * INTERVALO_MINIMO_MS, tela: undefined })).toBe(true)
  })

  it('não sincroniza com o agente no meio de um cadastro ou correção', () => {
    expect(deveSincronizar({ pendentes: 3, msDesdeUltima: INTERVALO_MINIMO_MS, tela: 'registrar' })).toBe(false)
    expect(deveSincronizar({ pendentes: 3, msDesdeUltima: INTERVALO_MINIMO_MS, tela: 'cliente-novo' })).toBe(false)
  })
})

describe('ultimaSincronizacao', () => {
  it('usa a data gravada no aparelho quando a sessão ainda não sincronizou', () => {
    expect(ultimaSincronizacao('2026-10-28T12:00:00Z')).toBe(Date.parse('2026-10-28T12:00:00Z'))
    expect(ultimaSincronizacao(null)).toBeGreaterThanOrEqual(0)
    expect(ultimaSincronizacao('lixo')).toBeGreaterThanOrEqual(0)
  })
})

describe('sincronizarUmaVez', () => {
  it('quem pede durante uma sincronização recebe a mesma, e as telas são avisadas uma vez', async () => {
    let terminar: (r: sync.SincronizacaoResult) => void = () => {}
    const spy = jest
      .spyOn(sync, 'sincronizar')
      .mockImplementation(() => new Promise<sync.SincronizacaoResult>((resolve) => (terminar = resolve)))
    const recarregar = jest.fn()
    const { unmount } = await renderHook(() => useAoSincronizar(recarregar))
    const mem = createMemoryDb()

    const a = sincronizarUmaVez(mem)
    const b = sincronizarUmaVez(mem)
    terminar(resultado)

    expect(await a).toBe(await b)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(recarregar).toHaveBeenCalledTimes(1)
    expect(ultimaSincronizacao(null)).toBeGreaterThan(Date.now() - 1000)
    await unmount()
    spy.mockRestore()
  })

  it('falha não avisa as telas e libera a próxima tentativa', async () => {
    const spy = jest.spyOn(sync, 'sincronizar').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(resultado)
    const recarregar = jest.fn()
    const { unmount } = await renderHook(() => useAoSincronizar(recarregar))
    const mem = createMemoryDb()

    await expect(sincronizarUmaVez(mem)).rejects.toThrow('offline')
    expect(recarregar).not.toHaveBeenCalled()
    await expect(sincronizarUmaVez(mem)).resolves.toBe(resultado)
    expect(recarregar).toHaveBeenCalledTimes(1)
    await unmount()
    spy.mockRestore()
  })
})
