import type { AgendaItem } from '../../types/api'

/**
 * Cores dos responsáveis no mapa (pino e legenda), na ordem em que aparecem.
 * Vêm dos tokens da paleta (CSS vars), então seguem Marinho/Oceano e o modo escuro.
 * `texto` é a cor do número sobre o `fundo`.
 */
export interface CorResponsavel {
  fundo: string
  texto: string
}

export const CORES_RESPONSAVEL: CorResponsavel[] = [
  { fundo: 'var(--brand)', texto: 'var(--brand-ink)' },
  { fundo: 'var(--accent)', texto: 'var(--accent-ink)' },
  { fundo: 'var(--warn-ink)', texto: 'var(--warn-bg)' },
  { fundo: 'var(--info-ink)', texto: 'var(--info-bg)' },
  { fundo: 'var(--ink-2)', texto: 'var(--surface)' },
  { fundo: 'var(--neg-ink)', texto: 'var(--neg-bg)' },
]

/** "2026-10-20" no fuso local, para comparar dias. */
export function chaveDoDia(d: string | Date): string {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Dias que têm visita, em ordem. */
export function diasComVisitas(items: AgendaItem[]): string[] {
  return [...new Set(items.filter((i) => i.dataAgendada).map((i) => chaveDoDia(i.dataAgendada!)))].sort()
}

/** Dia que o mapa abre: hoje, se tiver visita; senão o próximo; senão o último. */
export function diaInicial(dias: string[], hoje: Date = new Date()): string | null {
  if (dias.length === 0) return null
  const h = chaveDoDia(hoje)
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
export function coresPorResponsavel(items: AgendaItem[]): Map<number, CorResponsavel> {
  const ids = [...new Set(items.map((i) => i.usuarioId))].sort((a, b) => a - b)
  return new Map(ids.map((id, i) => [id, CORES_RESPONSAVEL[i % CORES_RESPONSAVEL.length]!]))
}
