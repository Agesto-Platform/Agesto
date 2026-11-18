import { describe, it, expect } from '@jest/globals'
import { countPendentes, ensureLocalOwner, PendenciasDeOutraContaError } from './localData'
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

  it('outro usuário ou outra empresa sem pendências reseta o banco local', async () => {
    const db = createMemoryDb()
    await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))
    await db.saveClientes([
      { id: 1, uuid: 'u1', nome: 'A', telefone: null, cpf: '0', logradouro: null, numero: null, bairro: null, cidade: null, cep: null },
    ])
    expect(await ensureLocalOwner(db, token({ sub: '3', empresaId: '1' }))).toBe(true)
    expect(await db.getClientes()).toHaveLength(0)
    expect(await db.getMeta('ownerSub')).toBe('3')

    expect(await ensureLocalOwner(db, token({ sub: '3', empresaId: '9' }))).toBe(true)
    expect(await db.getMeta('ownerEmpresaId')).toBe('9')
  })

  // MOB-01: a sessão anterior caiu sozinha (401) e outra pessoa entra no mesmo aparelho.
  it('outra conta com pendências de quem usou antes: avisa e não apaga nada', async () => {
    const db = createMemoryDb()
    await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }), { email: 'agente@a.local' })
    await semear(db)

    const tentativa = ensureLocalOwner(db, token({ sub: '3', empresaId: '1' }), { email: 'dono@a.local' })
    await expect(tentativa).rejects.toBeInstanceOf(PendenciasDeOutraContaError)
    await expect(tentativa).rejects.toMatchObject({ pendentes: 1, emailAnterior: 'agente@a.local' })
    expect(await countPendentes(db)).toBe(1)
    expect(await db.getMeta('ownerSub')).toBe('2')
  })

  it('outra conta confirma o descarte: apaga e passa a ser a dona', async () => {
    const db = createMemoryDb()
    await ensureLocalOwner(db, token({ sub: '2', empresaId: '1' }))
    await semear(db)

    expect(await ensureLocalOwner(db, token({ sub: '3', empresaId: '1' }), { descartarPendencias: true })).toBe(true)
    expect(await countPendentes(db)).toBe(0)
    expect(await db.getMeta('ownerSub')).toBe('3')
  })

  it('token sem sub/empresaId reseta por segurança, mas avisa se houver pendências', async () => {
    const db = createMemoryDb()
    await db.saveClientes([
      { id: 1, uuid: 'u1', nome: 'A', telefone: null, cpf: '0', logradouro: null, numero: null, bairro: null, cidade: null, cep: null },
    ])
    expect(await ensureLocalOwner(db, 'lixo')).toBe(true)
    expect(await db.getClientes()).toHaveLength(0)

    await semear(db)
    await expect(ensureLocalOwner(db, 'lixo')).rejects.toBeInstanceOf(PendenciasDeOutraContaError)
    expect(await countPendentes(db)).toBe(1)
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

  it('conta também serviços criados no app e ainda não enviados', async () => {
    const db = createMemoryDb()
    await db.addServico({
      uuid: 's1', descricao: 'Limpeza', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 100, syncedAt: null,
    })
    expect(await countPendentes(db)).toBe(1)
  })
})
