import { describe, it, expect, jest, afterEach } from '@jest/globals'
import { descarga } from './sync'
import { podeAlterar } from './emEnvio'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/errors'
import { createMemoryDb } from '@/db/memoryDb'
import type { LocalDb } from '@/db/types'
import type { SyncDescargaResponse } from '@/types/api'

// MOB-03: uma correção feita enquanto o envio está no ar (ou depois de um envio sem
// resposta) era marcada como enviada sem nunca chegar ao servidor.

async function comPendente(): Promise<LocalDb> {
  const db = createMemoryDb()
  await db.init()
  await db.addAtendimento({
    uuid: 'a1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-11-17T12:00:00Z', dataAgendada: null,
    itensProduto: [{ uuid: 'i1', produtoId: 1, quantidade: 1 }], itensServico: [], syncedAt: null,
  })
  return db
}

const resposta = (aceitos: string[]): SyncDescargaResponse =>
  ({
    clientesImportados: 0, atendimentosImportados: aceitos.length, conclusoesImportadas: 0, servicosImportados: 0,
    clientesSincronizados: [], servicosSincronizados: [], atendimentosSincronizados: aceitos,
    conclusoesSincronizadas: [], clientesMapeados: [], servicosMapeados: [], recusas: [], erros: [],
    sincronizadoEm: '2026-11-17T12:01:00Z',
  }) as unknown as SyncDescargaResponse

afterEach(() => {
  jest.restoreAllMocks()
})

describe('trava de edição durante o envio (MOB-03)', () => {
  it('trava enquanto o POST está no ar e libera com a resposta', async () => {
    const db = await comPendente()
    let liberar!: (r: SyncDescargaResponse) => void
    jest.spyOn(api, 'post').mockReturnValueOnce(new Promise((ok) => (liberar = ok)) as never)

    const envio = descarga(db)
    await new Promise((r) => setTimeout(r, 0))
    expect(await podeAlterar(db, 'a1')).toBe(false)

    liberar(resposta(['a1']))
    await envio
    expect(await podeAlterar(db, 'a1')).toBe(true)
    expect(await db.getPendingAtendimentos()).toHaveLength(0)
  })

  it('rede caiu no meio: o servidor pode ter gravado, segue travado até um envio com resposta', async () => {
    const db = await comPendente()
    jest.spyOn(api, 'post').mockRejectedValueOnce(new TypeError('Network request failed') as never)

    await expect(descarga(db)).rejects.toThrow('Network request failed')
    expect(await podeAlterar(db, 'a1')).toBe(false)
    expect(await db.getPendingAtendimentos()).toHaveLength(1)

    // O próximo envio reenvia a mesma versão e, com a resposta, libera.
    jest.spyOn(api, 'post').mockResolvedValueOnce(resposta(['a1']) as never)
    await descarga(db)
    expect(await podeAlterar(db, 'a1')).toBe(true)
    expect(await db.getPendingAtendimentos()).toHaveLength(0)
  })

  it('erro 500 também deixa travado; recusa 4xx libera para corrigir', async () => {
    const db = await comPendente()
    jest.spyOn(api, 'post').mockRejectedValueOnce(new ApiError(500, 'Erro interno') as never)
    await expect(descarga(db)).rejects.toBeInstanceOf(ApiError)
    expect(await podeAlterar(db, 'a1')).toBe(false)

    jest.spyOn(api, 'post').mockRejectedValueOnce(new ApiError(400, 'Falha de validação.') as never)
    await expect(descarga(db)).rejects.toBeInstanceOf(ApiError)
    expect(await podeAlterar(db, 'a1')).toBe(true)
  })

  it('a trava sobrevive a fechar o app (fica gravada no aparelho)', async () => {
    const db = await comPendente()
    jest.spyOn(api, 'post').mockRejectedValueOnce(new TypeError('Network request failed') as never)
    await expect(descarga(db)).rejects.toThrow()
    expect(JSON.parse((await db.getMeta('envioSemResposta')) ?? '[]')).toEqual(['a1'])
  })

  it('registro que não foi enviado pode ser alterado', async () => {
    const db = await comPendente()
    expect(await podeAlterar(db, 'outro')).toBe(true)
    expect(await podeAlterar(db, null)).toBe(true)
  })
})
