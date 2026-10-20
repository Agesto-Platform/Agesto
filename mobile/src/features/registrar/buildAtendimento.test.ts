import { describe, it, expect } from '@jest/globals'
import { buildAtendimento, estadoDoAtendimento, hasItems } from './buildAtendimento'

/** Os uuids dos itens são aleatórios; compara o resto. */
const semUuid = <T extends { uuid?: string }>(itens: T[]) => itens.map(({ uuid: _u, ...resto }) => resto)

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
    expect(semUuid(a.itensServico)).toEqual([{ servicoId: 2, quantidade: 1 }])
    expect(semUuid(a.itensProduto)).toEqual([{ produtoId: 5, quantidade: 3 }])
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
    expect(semUuid(a.itensProduto)).toEqual([
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
    expect(semUuid(a.itensServico)).toEqual([
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

  it('leva o valor ajustado e cada item com uuid próprio', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: { 2: 3 },
      produtoQty: { 5: 1, 6: 2 },
      precos: { servico: { 2: 80 }, produto: { 5: 19.9 } },
    })
    expect(semUuid(a.itensServico)).toEqual([{ servicoId: 2, precoUnitario: 80, quantidade: 3 }])
    expect(semUuid(a.itensProduto)).toEqual([
      { produtoId: 5, precoUnitario: 19.9, quantidade: 1 },
      { produtoId: 6, quantidade: 2 },
    ])
    const uuids = [...a.itensServico, ...a.itensProduto].map((i) => i.uuid)
    expect(new Set(uuids).size).toBe(3)
  })

  it('empreitada vira uma linha por unidade (DEC-04)', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: { 2: 2, 3: 2 },
      produtoQty: {},
      servicoNovoQty: { 's-novo': 2 },
      empreitada: { ids: [2], uuids: ['s-novo'] },
    })
    expect(semUuid(a.itensServico)).toEqual([
      { servicoId: 2, quantidade: 1 },
      { servicoId: 2, quantidade: 1 },
      { servicoId: 3, quantidade: 2 },
      { servicoId: null, servicoUuid: 's-novo', quantidade: 1 },
      { servicoId: null, servicoUuid: 's-novo', quantidade: 1 },
    ])
  })

  it('correção mantém uuid e data; conclusão marca existente', () => {
    const a = buildAtendimento({
      uuid: 'at-1',
      dataRegistro: '2026-10-20T10:00:00.000Z',
      existente: true,
      clienteId: 1,
      status: 'Concluido',
      servicoQty: {},
      produtoQty: {},
    })
    expect(a.uuid).toBe('at-1')
    expect(a.dataRegistro).toBe('2026-10-20T10:00:00.000Z')
    expect(a.existente).toBe(true)
    expect(buildAtendimento({ clienteId: 1, status: 'Concluido', servicoQty: {}, produtoQty: {} }).existente).toBeUndefined()
  })

  it('estadoDoAtendimento devolve a tela de onde o atendimento saiu', () => {
    const a = buildAtendimento({
      clienteId: 1,
      status: 'Concluido',
      servicoQty: { 2: 2, 3: 1 },
      produtoQty: { 5: 4 },
      servicoNovoQty: { 's-novo': 1 },
      avulsos: [{ descricao: 'Tubo', quantidade: 2, precoUnitario: 30 }],
      precos: { servico: { 3: 90 }, produto: { 5: 10 } },
      empreitada: { ids: [2], uuids: [] },
    })
    expect(estadoDoAtendimento(a)).toEqual({
      servicoQty: { 2: 2, 3: 1 },
      produtoQty: { 5: 4 },
      servicoNovoQty: { 's-novo': 1 },
      avulsos: [{ descricao: 'Tubo', quantidade: 2, precoUnitario: 30 }],
      precos: { servico: { 3: 90 }, produto: { 5: 10 } },
    })
  })
})
