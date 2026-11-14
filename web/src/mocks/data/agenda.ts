import { http, HttpResponse } from 'msw'
import type { AgendaItem, AvisosAgenda, StatusAtendimento } from '../../types/api'
import { ok } from '../lib/http'

/** Data no mês corrente (dia/hora local) em ISO. */
function at(day: number, hour: number, min = 0): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), day, hour, min).toISOString()
}

interface Seed {
  day: number
  hour: number
  min?: number
  status: StatusAtendimento
  valor: number
  nome: string
  tel: string | null
  endereco: string | null
  resumo: string
  /** Coordenadas em Uberaba (MG); null = cliente ainda sem localização. */
  local: [number, number] | null
}

const seeds: Seed[] = [
  { day: 2, hour: 9, status: 'Concluido', valor: 1200, nome: 'Vó Joana', tel: '(34) 99999-0000', endereco: 'R. das Acácias, 120 — Centro', resumo: 'Instalação de AC', local: [-19.7489, -47.9318] },
  { day: 3, hour: 14, status: 'Concluido', valor: 380, nome: 'Marina Alves', tel: '(34) 98888-1010', endereco: 'Av. Leopoldino, 45 — Fabrício', resumo: 'Manutenção preventiva', local: [-19.7617, -47.9406] },
  { day: 5, hour: 8, min: 30, status: 'Pendente', valor: 1640, nome: 'Renata Vieira', tel: null, endereco: 'Centro', resumo: 'Troca de compressor', local: null },
  { day: 5, hour: 15, status: 'Pendente', valor: 260, nome: 'Lúcia Teixeira', tel: '(34) 97777-2020', endereco: 'R. Segismundo, 88 — São Benedito', resumo: 'Limpeza / higienização', local: [-19.7402, -47.9265] },
  { day: 8, hour: 10, status: 'Pendente', valor: 520, nome: 'Carlos Menezes', tel: '(34) 96666-3030', endereco: 'Av. Guilhermina, 300 — Boa Vista', resumo: 'Instalação de AC', local: [-19.7705, -47.9551] },
  { day: 12, hour: 9, min: 15, status: 'Pendente', valor: 140, nome: 'Ana Prado', tel: '(34) 95555-4040', endereco: 'R. Tristão, 12 — Abadia', resumo: 'Manutenção preventiva', local: [-19.7512, -47.9452] },
  { day: 15, hour: 13, status: 'Pendente', valor: 900, nome: 'Pedro Nunes', tel: null, endereco: 'Distrito Industrial', resumo: 'Projeto de climatização', local: null },
  { day: 18, hour: 16, status: 'Cancelado', valor: 260, nome: 'Sofia Ramos', tel: '(34) 94444-5050', endereco: 'R. Artur Machado, 55 — Centro', resumo: 'Limpeza / higienização', local: [-19.7471, -47.9372] },
  { day: 22, hour: 11, status: 'Pendente', valor: 1200, nome: 'Vó Joana', tel: '(34) 99999-0000', endereco: 'R. das Acácias, 120 — Centro', resumo: 'Instalação de AC (2º andar)', local: [-19.7489, -47.9318] },
  // hoje, para o sino
  { day: new Date().getDate(), hour: 17, status: 'Pendente', valor: 310, nome: 'Marina Alves', tel: '(34) 98888-1010', endereco: 'Av. Leopoldino, 45 — Fabrício', resumo: 'Revisão do split', local: [-19.7617, -47.9406] },
]

/** Histórico: atendimentos registrados na hora, sem agendamento (mês passado). */
function noMesPassado(day: number, hour: number): string {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth() - 1, day, hour).toISOString()
}

const agendaSeed: AgendaItem[] = seeds.map((s, i) => ({
  id: 100 + i,
  uuid: crypto.randomUUID(),
  dataAgendada: at(s.day, s.hour, s.min),
  status: s.status,
  valorTotal: s.valor,
  usuarioId: (i % 3) + 1,
  clienteId: i + 1,
  clienteNome: s.nome,
  clienteTelefone: s.tel,
  enderecoResumo: s.endereco,
  latitude: s.local?.[0] ?? null,
  longitude: s.local?.[1] ?? null,
  resumo: s.resumo,
}))

const historicoSeed: AgendaItem[] = [
  { day: 6, hour: 10, nome: 'Vó Joana', resumo: 'Limpeza / higienização', valor: 260 },
  { day: 19, hour: 15, nome: 'Carlos Menezes', resumo: 'Manutenção preventiva', valor: 140 },
].map((h, i) => ({
  id: 200 + i,
  uuid: crypto.randomUUID(),
  dataAgendada: null,
  dataRegistro: noMesPassado(h.day, h.hour),
  status: 'Concluido' as StatusAtendimento,
  valorTotal: h.valor,
  usuarioId: 1,
  clienteId: 900 + i,
  clienteNome: h.nome,
  clienteTelefone: null,
  enderecoResumo: null,
  latitude: null,
  longitude: null,
  resumo: h.resumo,
}))

const quando = (i: AgendaItem) => i.dataAgendada ?? i.dataRegistro ?? ''

export const agendaHandlers = [
  http.get('*/api/atendimento/agenda', ({ request }) => {
    const url = new URL(request.url)
    const de = url.searchParams.get('de')
    const ate = url.searchParams.get('ate')
    // historico=true: o registrado sem agendamento entra no dia do registro (como a API)
    const historico = url.searchParams.get('historico') === 'true'
    const items = [...agendaSeed, ...(historico ? historicoSeed : [])]
      .filter((i) => quando(i))
      .filter((i) => (de ? quando(i) >= de : true))
      .filter((i) => (ate ? quando(i) <= ate : true))
      .sort((a, b) => (quando(a) < quando(b) ? -1 : 1))
    return HttpResponse.json(ok(items, 'Agenda encontrada.'))
  }),

  // Sino: pendentes agendados para hoje e os atrasados (como a API).
  http.get('*/api/atendimento/avisos', () => {
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)
    const fim = new Date(inicio)
    fim.setDate(fim.getDate() + 1)
    const pendentes = agendaSeed.filter((i) => i.status === 'Pendente' && i.dataAgendada)
    const hoje = pendentes
      .filter((i) => new Date(i.dataAgendada!) >= inicio && new Date(i.dataAgendada!) < fim)
      .sort((a, b) => a.dataAgendada!.localeCompare(b.dataAgendada!))
    const atrasados = pendentes
      .filter((i) => new Date(i.dataAgendada!) < inicio)
      .sort((a, b) => b.dataAgendada!.localeCompare(a.dataAgendada!))
    const data: AvisosAgenda = { hoje, atrasados: atrasados.slice(0, 20), totalAtrasados: atrasados.length }
    return HttpResponse.json(ok(data, 'Avisos encontrados.'))
  }),
]
