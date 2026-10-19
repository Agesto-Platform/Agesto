import { http, HttpResponse } from 'msw'
import type { AgendaItem, StatusAtendimento } from '../../types/api'
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
]

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

export const agendaHandlers = [
  http.get('*/api/atendimento/agenda', ({ request }) => {
    const url = new URL(request.url)
    const de = url.searchParams.get('de')
    const ate = url.searchParams.get('ate')
    const items = agendaSeed
      .filter((i) => i.dataAgendada != null)
      .filter((i) => (de ? i.dataAgendada! >= de : true))
      .filter((i) => (ate ? i.dataAgendada! <= ate : true))
      .sort((a, b) => (a.dataAgendada! < b.dataAgendada! ? -1 : 1))
    return HttpResponse.json(ok(items, 'Agenda encontrada.'))
  }),
]
