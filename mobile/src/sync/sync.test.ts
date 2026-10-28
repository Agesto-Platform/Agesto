import { describe, it, expect, jest } from '@jest/globals'
import { carga, initialSync, descarga, sincronizar, resumoSincronizacao, getRecusas, motivoDaRecusa } from './sync'
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

  it('descarga manda a conclusão de atendimento do servidor separada dos novos', async () => {
    const mem = createMemoryDb()
    await mem.addAtendimento({
      uuid: 'novo', clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-20', dataAgendada: null,
      itensProduto: [{ uuid: 'i1', produtoId: 1, quantidade: 1 }], itensServico: [], syncedAt: null,
    })
    await mem.addAtendimento({
      uuid: 'at-101', clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-20', dataAgendada: null,
      itensProduto: [{ uuid: 'i2', produtoId: 1, precoUnitario: 60, quantidade: 1 }], itensServico: [], existente: true, syncedAt: null,
    })
    const post = jest.spyOn(api, 'post')

    const r = await descarga(mem)

    const enviado = post.mock.calls[0][1] as SyncDescargaRequest
    expect(enviado.atendimentos.map((a) => a.uuid)).toEqual(['novo'])
    expect(enviado.conclusoes).toEqual([
      { uuid: 'at-101', status: 'Concluido', itensProduto: [{ uuid: 'i2', produtoId: 1, precoUnitario: 60, quantidade: 1 }], itensServico: [] },
    ])
    expect(r.conclusoesImportadas).toBe(1)
    expect(await mem.getPendingAtendimentos()).toHaveLength(0)
    post.mockRestore()
  })

  it('apaga só atendimento ainda não enviado', async () => {
    const mem = createMemoryDb()
    for (const [uuid, syncedAt] of [['pend', null], ['enviado', '2026-10-20T12:00:00Z']] as const) {
      await mem.addAtendimento({
        uuid, clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-20', dataAgendada: null,
        itensProduto: [], itensServico: [], syncedAt,
      })
    }
    await mem.deleteAtendimento('pend')
    await mem.deleteAtendimento('enviado')
    expect((await mem.getAtendimentos()).map((a) => a.uuid)).toEqual(['enviado'])
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

  it('guarda o motivo de cada recusa e, no atendimento de cliente recusado, mostra o do cliente', async () => {
    const mem = createMemoryDb()
    await mem.addCliente({
      uuid: 'c-ruim', nome: 'Joana', cpf: '11111111111', telefone: null,
      logradouro: null, numero: null, bairro: null, cidade: null, cep: null, syncedAt: null,
    })
    const base = { status: 'Concluido' as const, dataRegistro: '2026-08-11', dataAgendada: null, itensProduto: [], itensServico: [], syncedAt: null }
    await mem.addAtendimento({ ...base, uuid: 'a-cli', clienteId: null, clienteUuid: 'c-ruim' })
    await mem.addAtendimento({ ...base, uuid: 'A-EST', clienteId: 1 })
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce({
      clientesImportados: 0,
      atendimentosImportados: 0,
      clientesSincronizados: [],
      atendimentosSincronizados: [],
      erros: ['x', 'y', 'z', 'w'],
      recusas: [
        { uuid: 'c-ruim', motivo: 'CPF inválido.' },
        { uuid: 'a-cli', motivo: 'Cliente c-ruim não encontrado.' },
        { uuid: 'a-est', motivo: "Estoque insuficiente para produto 'Gás'." },
        { uuid: 'a-est', motivo: 'Data de registro inválida.' },
      ],
      sincronizadoEm: '2026-08-11T12:00:00Z',
    })

    await descarga(mem)

    const recusas = await getRecusas(mem)
    const pend = await mem.getPendingAtendimentos()
    expect(motivoDaRecusa(pend.find((a) => a.uuid === 'a-cli')!, recusas)).toBe('Cliente não aceito: CPF inválido.')
    expect(motivoDaRecusa(pend.find((a) => a.uuid === 'A-EST')!, recusas)).toBe(
      "Estoque insuficiente para produto 'Gás'. Data de registro inválida.",
    )
    post.mockRestore()
  })

  it('motivo do serviço novo recusado e motivo do próprio atendimento', () => {
    const semItens = { clienteUuid: null, itensServico: [] }
    expect(
      motivoDaRecusa(
        { uuid: 'x', clienteUuid: null, itensServico: [{ servicoId: null, servicoUuid: 'S1', quantidade: 1 }] },
        { s1: 'informe o valor do serviço.' },
      ),
    ).toBe('Serviço novo não aceito: informe o valor do serviço.')
    expect(motivoDaRecusa({ uuid: 'x', ...semItens }, { x: 'identificador em conflito.' })).toBe('Identificador em conflito.')
    expect(motivoDaRecusa({ uuid: 'y', ...semItens }, { x: 'outro' })).toBeNull()
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

  it('descarga envia serviço criado offline e religa os itens ao id do servidor', async () => {
    const mem = createMemoryDb()
    await mem.addServico({
      uuid: 's-novo', descricao: 'Limpeza de dreno', tipoCobranca: 'Empreitada',
      valorHora: null, valorEmpreitada: 120, syncedAt: null,
    })
    for (const uuid of ['a-ok', 'a-ruim']) {
      await mem.addAtendimento({
        uuid, clienteId: 1, status: 'Concluido', dataRegistro: '2026-10-17', dataAgendada: null,
        itensProduto: [], itensServico: [{ servicoId: null, servicoUuid: 's-novo', quantidade: 1 }], syncedAt: null,
      })
    }
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce({
      clientesImportados: 0,
      servicosImportados: 1,
      atendimentosImportados: 1,
      clientesSincronizados: [],
      servicosSincronizados: ['S-NOVO'],
      servicosMapeados: [{ uuid: 'S-NOVO', id: 55 }],
      atendimentosSincronizados: ['a-ok'],
      erros: ["Atendimento 'a-ruim': Estoque insuficiente."],
      sincronizadoEm: '2026-10-17T12:00:00Z',
    })

    const r = await descarga(mem)

    const enviado = post.mock.calls[0][1] as SyncDescargaRequest
    expect(enviado.servicos).toEqual([
      { uuid: 's-novo', descricao: 'Limpeza de dreno', tipoCobranca: 'Empreitada', valorHora: null, valorEmpreitada: 120 },
    ])
    expect(enviado.atendimentos[0].itensServico).toEqual([{ servicoId: null, servicoUuid: 's-novo', quantidade: 1 }])
    expect(r.servicosImportados).toBe(1)
    expect((await mem.getPendingServicos())[0].syncedAt).not.toBeNull()
    const pendente = await mem.getPendingAtendimentos()
    expect(pendente).toHaveLength(1)
    expect(pendente[0].itensServico).toEqual([{ servicoId: 55, servicoUuid: null, quantidade: 1 }])
    post.mockRestore()
  })

  it('serviço rejeitado pelo servidor segue pendente', async () => {
    const mem = createMemoryDb()
    await mem.addServico({
      uuid: 's-ruim', descricao: 'Visita', tipoCobranca: 'PorHora', valorHora: 80, valorEmpreitada: null, syncedAt: null,
    })
    const post = jest.spyOn(api, 'post').mockResolvedValueOnce({
      clientesImportados: 0,
      atendimentosImportados: 0,
      clientesSincronizados: [],
      atendimentosSincronizados: [],
      erros: ["Servico 'Visita': o cadastro de servico pelo app esta desligado."],
      sincronizadoEm: '2026-10-17T12:00:00Z',
    })

    const r = await descarga(mem)

    expect(r.erros).toHaveLength(1)
    expect((await mem.getPendingServicos())[0].syncedAt).toBeNull()
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

  it('descarga sem pendências retorna zeros e esquece as recusas antigas', async () => {
    const mem = createMemoryDb()
    await mem.setMeta('recusas', JSON.stringify({ velho: 'CPF inválido.' }))
    const r = await descarga(mem)
    expect(r.atendimentosImportados).toBe(0)
    expect(r.clientesImportados).toBe(0)
    expect(await getRecusas(mem)).toEqual({})
  })
})

describe('sync.sincronizar', () => {
  it('sem nada pendente, ainda baixa a Carga e a agenda', async () => {
    const mem = createMemoryDb()
    await mem.init()

    const r = await sincronizar(mem)

    expect(r.enviado.atendimentosImportados).toBe(0)
    expect(r.recebido.agenda).toBe(3)
    expect((await mem.getClientes()).length).toBe(3)
    expect(resumoSincronizacao(r)).toBe('Dados atualizados. Agenda de hoje: 3 visitas.')
  })

  it('resumo cita o que foi enviado e o que ficou pendente', () => {
    const recebido = { clientes: 0, produtos: 0, servicos: 0, agenda: 1 }
    expect(
      resumoSincronizacao({ enviado: { clientesImportados: 1, servicosImportados: 0, atendimentosImportados: 1, conclusoesImportadas: 1, erros: [] }, recebido }),
    ).toBe('Enviados: 2 atendimento(s), 1 cliente(s). Agenda de hoje: 1 visita.')
    expect(
      resumoSincronizacao({ enviado: { clientesImportados: 0, servicosImportados: 0, atendimentosImportados: 0, conclusoesImportadas: 0, erros: ['A: x'] }, recebido }),
    ).toContain('1 não enviado(s)')
    expect(
      resumoSincronizacao({ enviado: { clientesImportados: 0, servicosImportados: 0, atendimentosImportados: 0, conclusoesImportadas: 0, erros: ['A: x', 'B: y'] }, recebido }),
    ).toBe('Enviados: 0 atendimento(s), 0 cliente(s). 2 não enviado(s), seguem pendentes: A: x O motivo de cada um aparece em Atendimentos.')
  })
})
