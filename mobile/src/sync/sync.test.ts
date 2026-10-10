import { describe, it, expect, jest } from '@jest/globals'
import { carga, initialSync, descarga } from './sync'
import { api } from '@/lib/api'
import type { SyncDescargaRequest } from '@/types/api'
import { createMemoryDb } from '@/db/memoryDb'
import { getConfig, DEFAULT_CONFIG } from '@/lib/appConfig'
import { getSugeridos } from '@/lib/sugeridos'

describe('sync.carga (mock)', () => {
  it('popula o banco injetado com os dados de referência e marca lastSync', async () => {
    const mem = createMemoryDb()
    await mem.init()

    const r = await carga(mem)
    expect(r.clientes).toBe(3)
    expect(r.produtos).toBe(3)
    expect(r.servicos).toBe(3)

    const clientes = await mem.getClientes()
    expect(clientes[0].nome).toBe('Vó Joana')
    expect(await mem.getMeta('lastSync')).not.toBeNull()
  })

  it('carga salva a configuração da empresa vinda do servidor', async () => {
    const mem = createMemoryDb()
    await mem.init()

    await carga(mem)

    const config = await getConfig(mem)
    expect(config.modoAgendaAgente).toBe('Flexivel')
    expect(config.controlaEstoque).toBe(true)
  })

  it('getConfig devolve o default seguro quando não há config local', async () => {
    const mem = createMemoryDb()
    await mem.init()

    expect(await getConfig(mem)).toEqual(DEFAULT_CONFIG)
  })

  it('carga salva os materiais sugeridos vindos do servidor', async () => {
    const mem = createMemoryDb()
    await mem.init()

    await carga(mem)

    const sugeridos = await getSugeridos(mem)
    expect(sugeridos.length).toBeGreaterThan(0)
    expect(sugeridos[0]).toHaveProperty('servicoId')
    expect(sugeridos[0]).toHaveProperty('produtoId')
  })

  it('initialSync popula referência e agenda do dia', async () => {
    const mem = createMemoryDb()
    await mem.init()

    const r = await initialSync(mem)
    expect(r.clientes).toBe(3)
    expect(r.agenda).toBe(3)

    const agenda = await mem.getAgenda()
    expect(agenda).toHaveLength(3)
    expect(agenda[0].clienteNome).toBeTruthy()
  })

  it('descarga empurra pendentes e marca como sincronizado', async () => {
    const mem = createMemoryDb()
    await mem.addCliente({
      uuid: 'c1', nome: 'Novo', cpf: '11122233344', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    await mem.addAtendimento({
      uuid: 'a1', clienteId: 1, status: 'Concluido', dataRegistro: '2026-08-11', dataAgendada: null,
      itensProduto: [{ produtoId: 1, quantidade: 2 }], itensServico: [], syncedAt: null,
    })

    const r = await descarga(mem)
    expect(r.clientesImportados).toBe(1)
    expect(r.atendimentosImportados).toBe(1)
    expect(await mem.getPendingAtendimentos()).toHaveLength(0)
    expect((await mem.getPendingClientes())[0].syncedAt).not.toBeNull()
  })

  it('descarga mantém pendente o que o servidor rejeitou', async () => {
    const mem = createMemoryDb()
    await mem.addCliente({
      uuid: 'c-ok', nome: 'Aceito', cpf: '11122233344', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    await mem.addCliente({
      uuid: 'c-ruim', nome: 'Rejeitado', cpf: '55566677788', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    for (const uuid of ['A-OK', 'a-ruim']) {
      await mem.addAtendimento({
        uuid, clienteId: 1, status: 'Concluido', dataRegistro: '2026-08-11', dataAgendada: null,
        itensProduto: [], itensServico: [], syncedAt: null,
      })
    }
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce({
      clientesImportados: 1,
      atendimentosImportados: 1,
      clientesSincronizados: ['c-ok'],
      atendimentosSincronizados: ['a-ok'], // Guid do servidor vem em minúsculas
      erros: ["Atendimento 'a-ruim': Estoque insuficiente para produto 'Gás'."],
      sincronizadoEm: '2026-08-11T12:00:00Z',
    })

    const r = await descarga(mem)

    expect(r.erros).toHaveLength(1)
    expect((await mem.getPendingAtendimentos()).map((a) => a.uuid)).toEqual(['a-ruim'])
    const clientes = await mem.getPendingClientes()
    expect(clientes.find((c) => c.uuid === 'c-ok')?.syncedAt).not.toBeNull()
    expect(clientes.find((c) => c.uuid === 'c-ruim')?.syncedAt).toBeNull()
    const enviado = post.mock.calls[0][1] as SyncDescargaRequest
    expect(enviado.clientes.map((c) => c.uuid)).toEqual(['c-ok', 'c-ruim'])
    post.mockRestore()
  })

  it('descarga envia clienteUuid e religa ao id do servidor, inclusive o rejeitado', async () => {
    const mem = createMemoryDb()
    await mem.addCliente({
      uuid: 'c-novo', nome: 'Novo', cpf: '11122233344', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    for (const uuid of ['a-ok', 'a-ruim']) {
      await mem.addAtendimento({
        uuid, clienteId: null, clienteUuid: 'c-novo', status: 'Concluido', dataRegistro: '2026-08-11',
        dataAgendada: null, itensProduto: [], itensServico: [], syncedAt: null,
      })
    }
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce({
      clientesImportados: 1,
      atendimentosImportados: 1,
      clientesSincronizados: ['C-NOVO'],
      atendimentosSincronizados: ['a-ok'],
      clientesMapeados: [{ uuid: 'C-NOVO', id: 77 }],
      erros: ["Atendimento 'a-ruim': Estoque insuficiente."],
      sincronizadoEm: '2026-08-11T12:00:00Z',
    })

    await descarga(mem)

    const enviado = post.mock.calls[0][1] as SyncDescargaRequest
    expect(enviado.atendimentos.map((a) => a.clienteUuid)).toEqual(['c-novo', 'c-novo'])
    const pendente = await mem.getPendingAtendimentos()
    expect(pendente).toHaveLength(1)
    expect(pendente[0]).toMatchObject({ uuid: 'a-ruim', clienteId: 77, clienteUuid: null })
    post.mockRestore()
  })

  it('carga é sempre completa, mesmo após uma sincronização anterior', async () => {
    const mem = createMemoryDb()
    await mem.init()
    await mem.setMeta('lastSync', '2026-08-11T12:00:00Z')
    const get = jest.spyOn(api, 'get')

    await carga(mem)

    expect(get).toHaveBeenCalledWith('/api/sync/carga')
    get.mockRestore()
  })

  it('descarga sem pendências retorna zeros', async () => {
    const mem = createMemoryDb()
    const r = await descarga(mem)
    expect(r.atendimentosImportados).toBe(0)
    expect(r.clientesImportados).toBe(0)
  })
})
