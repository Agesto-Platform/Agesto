import type { AgendaItem } from '@/types/api'

/** O Google Maps aceita o destino e até 9 paradas intermediárias pela URL. */
export const MAX_PARADAS = 10

export interface Rota {
  /** URL do Google Maps com as paradas na ordem; null quando não há parada com endereço. */
  url: string | null
  paradas: AgendaItem[]
  /** Visitas do dia que ficaram fora: cliente sem rua cadastrada. */
  semEndereco: AgendaItem[]
  /** Visitas além do limite da URL; entram ao recalcular depois das primeiras. */
  excedentes: AgendaItem[]
}

function mesmoDia(iso: string, dia: Date): boolean {
  const d = new Date(iso)
  return d.getFullYear() === dia.getFullYear() && d.getMonth() === dia.getMonth() && d.getDate() === dia.getDate()
}

/** Visitas pendentes do dia, na ordem dos horários marcados. */
export function visitasDoDia(items: AgendaItem[], dia: Date = new Date()): AgendaItem[] {
  return items
    .filter((i) => i.status === 'Pendente' && i.dataAgendada !== null && mesmoDia(i.dataAgendada, dia))
    .sort((a, b) => new Date(a.dataAgendada!).getTime() - new Date(b.dataAgendada!).getTime())
}

/** Link de navegação até um endereço (origem = localização atual do celular). */
export function urlNavegacao(destino: string, paradas: string[] = []): string {
  const params = [`api=1`, `travelmode=driving`, `destination=${encodeURIComponent(destino)}`]
  if (paradas.length > 0) params.push(`waypoints=${encodeURIComponent(paradas.join('|'))}`)
  return `https://www.google.com/maps/dir/?${params.join('&')}`
}

/** Rota do dia: visitas pendentes com endereço, na ordem dos horários. */
export function montarRota(items: AgendaItem[], dia: Date = new Date()): Rota {
  const visitas = visitasDoDia(items, dia)
  const comEndereco = visitas.filter((v) => v.enderecoCompleto)
  const paradas = comEndereco.slice(0, MAX_PARADAS)
  const enderecos = paradas.map((p) => p.enderecoCompleto!)

  return {
    url: enderecos.length > 0 ? urlNavegacao(enderecos[enderecos.length - 1], enderecos.slice(0, -1)) : null,
    paradas,
    semEndereco: visitas.filter((v) => !v.enderecoCompleto),
    excedentes: comEndereco.slice(MAX_PARADAS),
  }
}
