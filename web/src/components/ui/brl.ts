/** Formatos de dinheiro e percentual (pt-BR). */
const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const BRL_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

/** Texto em BRL ("R$ 1.200"); `cents` mostra os centavos. Nulo vira "—". */
export function brl(value: number | null | undefined, cents = false): string {
  if (value == null) return '—'
  return (cents ? BRL_CENTS : BRL).format(value)
}

/** Percentual no formato brasileiro ("61,7%"). */
export function pct(value: number, digits = 1): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
}
