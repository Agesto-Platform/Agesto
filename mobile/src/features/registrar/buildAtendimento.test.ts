import { describe, it, expect } from '@jest/globals'
import { buildAtendimento, hasItems } from './buildAtendimento'

describe('buildAtendimento', () => {
  it('hasItems detecta quantidades > 0', () => {
    expect(hasItems({}, {})).toBe(false)
    expect(hasItems({ 1: 0 }, { 2: 0 })).toBe(false)
    expect(hasItems({ 1: 2 }, {})).toBe(true)
    expect(hasItems({}, { 3: 1 })).toBe(true)
  })

  it('monta itens de catálogo por quantidade e marca como pendente', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: { 2: 1, 3: 0 },
      produtoQty: { 5: 3 },
    })
    expect(a.clienteId).toBe(1)
    expect(a.status).toBe('Concluido')
    expect(a.itensServico).toEqual([{ servicoId: 2, quantidade: 1 }])
    expect(a.itensProduto).toEqual([{ produtoId: 5, quantidade: 3 }])
    expect(a.syncedAt).toBeNull()
    expect(a.uuid).toBeTruthy()
    expect(a.dataRegistro).toBeTruthy()
    expect(a.dataAgendada).toBeNull() // registro imediato: sem data agendada
  })

  it('leva item avulso sem produtoId, com descrição e valor', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: {},
      produtoQty: { 5: 1 },
      avulsos: [{ descricao: 'Tubo de cobre', quantidade: 2, precoUnitario: 30 }],
    })
    expect(a.itensProduto).toEqual([
      { produtoId: 5, quantidade: 1 },
      { produtoId: null, descricao: 'Tubo de cobre', precoUnitario: 30, quantidade: 2 },
    ])
    expect(hasItems({}, {}, {}, [{ descricao: 'x', quantidade: 1, precoUnitario: 0 }])).toBe(true)
  })

  it('leva serviço criado offline pelo uuid, sem id do servidor', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: { 2: 1 },
      produtoQty: {},
      servicoNovoQty: { 's-novo': 1, 's-zerado': 0 },
    })
    expect(a.itensServico).toEqual([
      { servicoId: 2, quantidade: 1 },
      { servicoId: null, servicoUuid: 's-novo', quantidade: 1 },
    ])
    expect(hasItems({}, {}, { 's-novo': 1 })).toBe(true)
  })

  it('agenda quando dataAgendada é informada', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Pendente',
      servicoQty: { 2: 1 },
      produtoQty: {},
      dataAgendada: '2026-08-20T14:00:00.000Z',
    })
    expect(a.dataAgendada).toBe('2026-08-20T14:00:00.000Z')
    expect(a.status).toBe('Pendente')
  })
})
