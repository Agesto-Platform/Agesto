import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import type { AgendaItem } from '@/types/api'
import { createMemoryDb } from '@/db/memoryDb'

// Módulo nativo falso: registra o que seria agendado.
const mockAgendadas: { identifier: string; content: { title: string; body: string }; trigger: unknown }[] = []
let mockPermissao = { granted: true, canAskAgain: true }
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => mockPermissao),
  requestPermissionsAsync: jest.fn(async () => mockPermissao),
  setNotificationChannelAsync: jest.fn(async () => null),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockAgendadas.map((a) => ({ identifier: a.identifier }))),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = mockAgendadas.findIndex((a) => a.identifier === id)
    if (i >= 0) mockAgendadas.splice(i, 1)
  }),
  scheduleNotificationAsync: jest.fn(async (req: (typeof mockAgendadas)[number]) => {
    mockAgendadas.push(req)
    return req.identifier
  }),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}))

// eslint-disable-next-line import/first
import { agendarAvisosDoDia, cancelarAvisosDoDia, planejarAvisos } from './avisosDoDia'

function item(id: number, data: string | null, status: AgendaItem['status'] = 'Pendente', nome = `Cliente ${id}`): AgendaItem {
  return {
    id,
    uuid: `u${id}`,
    dataAgendada: data,
    status,
    valorTotal: 100,
    clienteId: id,
    clienteNome: nome,
    clienteTelefone: null,
    enderecoResumo: null,
    resumo: 'Instalação de AC',
  } as AgendaItem
}

// 14/11/2026 (local)
const local = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()

describe('planejarAvisos', () => {
  const agenda = [
    item(1, local(14, 9), 'Pendente', 'Vó Joana'),
    item(2, local(14, 15, 30), 'Pendente', 'Marina'),
    item(3, local(14, 11), 'Concluido'),
    item(4, local(16, 8)),
    item(5, local(13, 9)), // ontem: não avisa
    item(6, null), // sem agendamento
  ]

  it('antes das 7h: hoje às 7h e os próximos dias também às 7h, com os horários', () => {
    const avisos = planejarAvisos(agenda, new Date(2026, 10, 14, 6, 0), false)
    expect(avisos.map((a) => [a.dia, a.quando?.getHours()])).toEqual([
      ['2026-11-14', 7],
      ['2026-11-16', 7],
    ])
    expect(avisos[0]!.titulo).toBe('Hoje: 2 atendimentos pendentes')
    expect(avisos[0]!.corpo).toBe('09:00 · Vó Joana — Instalação de AC\n15:30 · Marina — Instalação de AC')
  })

  it('depois das 7h: avisa agora, uma vez por dia', () => {
    expect(planejarAvisos(agenda, new Date(2026, 10, 14, 10, 0), false)[0]!.quando).toBeNull()
    expect(planejarAvisos(agenda, new Date(2026, 10, 14, 10, 0), true).map((a) => a.dia)).toEqual(['2026-11-16'])
  })

  it('mais de 3 no dia: mostra 3 e "e mais"', () => {
    const cheio = [1, 2, 3, 4, 5].map((i) => item(i, local(20, 8 + i)))
    const [aviso] = planejarAvisos(cheio, new Date(2026, 10, 14, 10, 0), false)
    expect(aviso!.titulo).toBe('Hoje: 5 atendimentos pendentes')
    expect(aviso!.corpo.split('\n')).toHaveLength(4)
    expect(aviso!.corpo).toContain('e mais 2')
  })
})

describe('agendarAvisosDoDia', () => {
  beforeEach(() => {
    mockAgendadas.length = 0
    mockPermissao = { granted: true, canAskAgain: true }
  })

  it('troca os avisos pelos da agenda local e não repete o de hoje', async () => {
    const mem = createMemoryDb()
    await mem.init()
    await mem.saveAgenda([item(1, local(14, 15)), item(2, local(15, 9))])

    await agendarAvisosDoDia(mem, new Date(2026, 10, 14, 10, 0))
    expect(mockAgendadas.map((a) => [a.identifier, a.trigger])).toEqual([
      ['agesto-dia-2026-11-14', { channelId: 'agenda' }],
      ['agesto-dia-2026-11-15', { type: 'date', date: new Date(2026, 10, 15, 7, 0), channelId: 'agenda' }],
    ])

    // nova sincronização no mesmo dia: só o de amanhã continua agendado
    await agendarAvisosDoDia(mem, new Date(2026, 10, 14, 11, 0))
    expect(mockAgendadas.map((a) => a.identifier)).toEqual(['agesto-dia-2026-11-15'])

    await cancelarAvisosDoDia()
    expect(mockAgendadas).toHaveLength(0)
  })

  it('sem permissão, não agenda nada', async () => {
    mockPermissao = { granted: false, canAskAgain: false }
    const mem = createMemoryDb()
    await mem.init()
    await mem.saveAgenda([item(1, local(15, 9))])

    await agendarAvisosDoDia(mem, new Date(2026, 10, 14, 10, 0))
    expect(mockAgendadas).toHaveLength(0)
  })
})
