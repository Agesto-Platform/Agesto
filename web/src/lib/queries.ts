import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { periodRange, agendaRange } from './period'
import type { AgendaPeriod, Period } from '../layout/PeriodSwitch'
import type { DashboardResponse, AgendaItem, AvisosAgenda } from '../types/api'

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

/**
 * Agenda de um mês com histórico: o que foi agendado e o que foi registrado sem
 * agendamento (no dia do registro). Um mês por vez, dentro do teto de 62 dias da API.
 */
export function useAgendaDoMes(de: string, ate: string) {
  return useQuery({
    queryKey: ['agenda', 'mes', de, ate],
    queryFn: () =>
      api.get<AgendaItem[]>(
        `/api/atendimento/agenda?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}&historico=true`,
      ),
  })
}

/** Sino do topo: pendentes de hoje e atrasados. Atualiza a cada 5 minutos e ao voltar à aba. */
export function useAvisos() {
  return useQuery({
    queryKey: ['agenda', 'avisos'],
    queryFn: () => api.get<AvisosAgenda>('/api/atendimento/avisos'),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
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
