import type { AgendaItem } from '../../types/api'

/** Cores dos responsáveis no mapa (pino e legenda), na ordem em que aparecem. */
export const CORES_RESPONSAVEL = ['#12B886', '#243FA6', '#E8590C', '#AE3EC9', '#1098AD', '#F59F00']

export function chaveDoDia(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias que têm visita, em ordem, para o seletor do mapa. */
export function diasComVisitas(items: AgendaItem[]): string[] {
  return [...new Set(items.filter((i) => i.dataAgendada).map((i) => chaveDoDia(i.dataAgendada!)))].sort()
}

/** Dia que o mapa abre: hoje, se tiver visita; senão o próximo; senão o último. */
export function diaInicial(dias: string[], hoje: Date = new Date()): string | null {
  if (dias.length === 0) return null
  const h = chaveDoDia(hoje.toISOString())
  return dias.find((d) => d >= h) ?? dias[dias.length - 1]
}

export interface PontoMapa {
  item: AgendaItem
  /** Posição na ordem do dia (1, 2, 3…), pelo horário. */
  ordem: number
  latitude: number
  longitude: number
}

/** Visitas do dia em ordem de horário, separando as que ainda não têm localização. */
export function pontosDoDia(items: AgendaItem[], dia: string): { pontos: PontoMapa[]; semLocal: AgendaItem[] } {
  const doDia = items
    .filter((i) => i.dataAgendada && chaveDoDia(i.dataAgendada) === dia)
    .sort((a, b) => a.dataAgendada!.localeCompare(b.dataAgendada!))
  const pontos: PontoMapa[] = []
  const semLocal: AgendaItem[] = []
  doDia.forEach((item, idx) => {
    if (item.latitude != null && item.longitude != null) {
      pontos.push({ item, ordem: idx + 1, latitude: item.latitude, longitude: item.longitude })
    } else {
      semLocal.push(item)
    }
  })
  return { pontos, semLocal }
}

/** Cor estável por responsável dentro do conjunto exibido. */
export function coresPorResponsavel(items: AgendaItem[]): Map<number, string> {
  const ids = [...new Set(items.map((i) => i.usuarioId))].sort((a, b) => a - b)
  return new Map(ids.map((id, i) => [id, CORES_RESPONSAVEL[i % CORES_RESPONSAVEL.length]]))
}
