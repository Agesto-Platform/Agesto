import type { AgendaItem } from '@/types/api'

/**
 * Só os atendimentos agendados para o dia de `hoje` (horário do aparelho),
 * do mais cedo ao mais tarde. A agenda guardada cobre vários dias (a Carga traz
 * de hoje até 14 dias à frente); a tela Início mostra só o dia.
 */
export function agendaDoDia(itens: AgendaItem[], hoje: Date = new Date()): AgendaItem[] {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const dia = hoje.getDate()
  return itens
    .filter((i) => {
      if (!i.dataAgendada) return false
      const d = new Date(i.dataAgendada)
      return d.getFullYear() === ano && d.getMonth() === mes && d.getDate() === dia
    })
    .sort((a, b) => String(a.dataAgendada).localeCompare(String(b.dataAgendada)))
}
