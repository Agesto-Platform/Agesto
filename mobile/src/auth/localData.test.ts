import { describe, it, expect } from '@jest/globals'
import { countPendentes, ensureLocalOwner } from './localData'
import { createMemoryDb } from '@/db/memoryDb'
import type { LocalDb } from '@/db/types'

/** JWT fake: só o payload importa (decode sem verificar assinatura). */
function token(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `h.${b64}.s`
}

async function semear(db: LocalDb): Promise<void> {
  await db.saveClientes([
    { id: 1, uuid: 'u1', nome: 'A', telefone: null, cpf: '0', logradouro: null, numero: null, bairro: null, cidade: null, cep: null },
  ])
  await db.addAtendimento({
    uuid: 'a1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-08-05', dataAgendada: null,
    itensProduto: [], itensServico: [], syncedAt: null,
  })
}

describe('ensureLocalOwner', () => {
  it('primeiro login grava sub/empresaId e mantém os dados', async () => {
    const db = createMemoryDb()
    await semear(db)
    expect(await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))).toBe(false)
    expect(await db.getMeta('ownerSub')).toBe('2')
    expect(await db.getClientes()).toHaveLength(1)
  })

  it('mesmo usuário de novo não apaga nada', async () => {
    const db = createMemoryDb()
    await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))
    await semear(db)
    expect(await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))).toBe(false)
    expect(await countPendentes(db)).toBe(1)
  })

  it('outro usuário ou outra empresa reseta o banco local', async () => {
    const db = createMemoryDb()
    await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))
    await semear(db)
    expect(await ensureLocalOwner(db, token({ sub: '3', empresaId: '1' }))).toBe(true)
    expect(await db.getClientes()).toHaveLength(0)
    expect(await db.getAtendimentos()).toHaveLength(0)
    expect(await db.getMeta('ownerSub')).toBe('3')

    await semear(db)
    expect(await ensureLocalOwner(db, token({ sub: '3', empresaId: '9' }))).toBe(true)
    expect(await db.getAtendimentos()).toHaveLength(0)
  })

  it('token sem sub/empresaId reseta por segurança', async () => {
    const db = createMemoryDb()
    await semear(db)
    expect(await ensureLocalOwner(db, 'lixo')).toBe(true)
    expect(await db.getClientes()).toHaveLength(0)
  })
})

describe('countPendentes', () => {
  it('soma atendimentos e clientes ainda não enviados', async () => {
    const db = createMemoryDb()
    await semear(db)
    await db.addCliente({
      uuid: 'c1', nome: 'B', telefone: null, cpf: '1', logradouro: null, numero: null,
      bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    await db.addCliente({
      uuid: 'c2', nome: 'C', telefone: null, cpf: '2', logradouro: null, numero: null,
      bairro: null, cidade: null, cep: null, syncedAt: '2026-08-05T10:00:00Z',
    })
    expect(await countPendentes(db)).toBe(2)
  })
})
