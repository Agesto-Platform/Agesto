import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { periodRange, agendaRange } from './period'
import type { AgendaPeriod, Period } from '../layout/PeriodSwitch'
import type { DashboardResponse, AgendaItem } from '../types/api'

/** Dashboard consolidado do período selecionado. */
export function useDashboard(period: Period) {
  const { de, ate } = periodRange(period)
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: () =>
      api.get<DashboardResponse>(
        `/api/metrics/dashboard?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`,
      ),
  })
}

/** Agenda de atendimentos agendados no período (enriquecida). */
export function useAgenda(period: AgendaPeriod) {
  const { de, ate } = agendaRange(period)
  return useQuery({
    queryKey: ['agenda', period],
    queryFn: () =>
      api.get<AgendaItem[]>(
        `/api/atendimento/agenda?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`,
      ),
  })
}
