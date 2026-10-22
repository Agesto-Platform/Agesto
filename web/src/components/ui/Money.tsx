import { brl } from './brl'

/** Dinheiro em BRL com números de largura fixa (as colunas alinham). */
export function Money({
  value,
  cents = false,
  className = '',
}: {
  value: number | null | undefined
  cents?: boolean
  className?: string
}) {
  return <span className={`money${className ? ' ' + className : ''}`}>{brl(value, cents)}</span>
}
