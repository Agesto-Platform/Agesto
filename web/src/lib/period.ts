import type { AgendaPeriod, Period } from '../layout/PeriodSwitch'

/** Na agenda, "Ano" vira "Mês": a API não devolve o ano inteiro (PAG-02). */
export function agendaPeriod(p: Period): AgendaPeriod {
  return p === 'ano' ? 'mes' : p
}

/** Converte o período da topbar numa janela [de, ate] em ISO (UTC). */
export function periodRange(
  period: Period,
  now = new Date(),
): { de: string; ate: string } {
  const de = new Date(now)
  de.setHours(0, 0, 0, 0)

  if (period === '7d') {
    de.setDate(de.getDate() - 6)
  } else if (period === 'mes') {
    de.setDate(1)
  } else {
    de.setMonth(0, 1) // ano corrente, 1º de janeiro
  }

  return { de: de.toISOString(), ate: now.toISOString() }
}

/**
 * Janela do período para a **agenda** — inclui o futuro (ao contrário do
 * range analítico, que termina em "agora"). Cobre o período inteiro.
 */
export function agendaRange(
  period: AgendaPeriod,
  now = new Date(),
): { de: string; ate: string } {
  const de = new Date(now)
  de.setHours(0, 0, 0, 0)
  const ate = new Date(now)
  ate.setHours(23, 59, 59, 999)

  if (period === '7d') {
    ate.setDate(ate.getDate() + 7)
  } else {
    de.setDate(1)
    ate.setMonth(ate.getMonth() + 1, 0) // último dia do mês corrente
  }

  return { de: de.toISOString(), ate: ate.toISOString() }
}
