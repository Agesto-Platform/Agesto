import { describe, it, expect } from '@jest/globals'
import { createMemoryDb } from './memoryDb'
import type { Cliente } from '@/types/api'

const cliente = (id: number, nome: string): Cliente => ({
  id, uuid: `u${id}`, nome, telefone: null, cpf: '00000000000',
  logradouro: null, numero: null, bairro: null, cidade: null, cep: null,
})

describe('memoryDb', () => {
  it('salva e lê dados de referência', async () => {
    const db = createMemoryDb()
    await db.init()
    await db.saveClientes([cliente(1, 'Vó Joana'), cliente(2, 'Marina')])
    const c = await db.getClientes()
    expect(c).toHaveLength(2)
    expect(c[0].nome).toBe('Vó Joana')
  })

  it('saveClientes substitui em bloco (comportamento da Carga)', async () => {
    const db = createMemoryDb()
    await db.saveClientes([cliente(1, 'A')])
    await db.saveClientes([cliente(2, 'B'), cliente(3, 'C')])
    const c = await db.getClientes()
    expect(c.map((x) => x.id)).toEqual([2, 3])
  })

  it('atendimento offline entra pendente e vira sincronizado', async () => {
    const db = createMemoryDb()
    await db.addAtendimento({
      uuid: 'a1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-08-05', dataAgendada: null,
      itensProduto: [{ produtoId: 1, quantidade: 2 }], itensServico: [], syncedAt: null,
    })
    expect(await db.getPendingAtendimentos()).toHaveLength(1)

    await db.markSynced(['a1'], '2026-08-05T10:00:00Z')
    expect(await db.getPendingAtendimentos()).toHaveLength(0)
    expect((await db.getAtendimentos())[0].syncedAt).toBe('2026-08-05T10:00:00Z')
  })

  it('meta guarda valores e reset limpa tudo', async () => {
    const db = createMemoryDb()
    await db.setMeta('lastSync', '2026-08-05')
    expect(await db.getMeta('lastSync')).toBe('2026-08-05')
    await db.saveClientes([cliente(1, 'A')])
    await db.reset()
    expect(await db.getMeta('lastSync')).toBeNull()
    expect(await db.getClientes()).toHaveLength(0)
  })

  it('cliente offline entra pendente e vira sincronizado', async () => {
    const db = createMemoryDb()
    await db.addCliente({
      uuid: 'cx', nome: 'Novo Cliente', cpf: '11122233344', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    expect(await db.getPendingClientes()).toHaveLength(1)

    await db.markClientesSynced(['cx'], '2026-08-11T10:00:00Z')
    expect((await db.getPendingClientes())[0].syncedAt).toBe('2026-08-11T10:00:00Z')
  })

  it('serviço offline entra pendente e religa os itens de atendimento', async () => {
    const db = createMemoryDb()
    await db.addServico({ uuid: 's1', descricao: 'Dreno', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 120, syncedAt: null })
    await db.addAtendimento({
      uuid: 'a1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-17', dataAgendada: null,
      itensProduto: [], itensServico: [{ servicoId: 3, quantidade: 1 }, { servicoId: null, servicoUuid: 's1', quantidade: 1 }], syncedAt: null,
    })

    await db.remapServico('s1', 40)
    await db.markServicosSynced(['s1'], '2026-10-17T12:00:00Z')

    expect((await db.getAtendimentos())[0].itensServico).toEqual([
      { servicoId: 3, quantidade: 1 },
      { servicoId: 40, servicoUuid: null, quantidade: 1 },
    ])
    expect((await db.getPendingServicos())[0].syncedAt).toBe('2026-10-17T12:00:00Z')
    await db.reset()
    expect(await db.getPendingServicos()).toEqual([])
  })
})
