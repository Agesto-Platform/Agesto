import { Seg } from '../components/ui'

export type Period = '7d' | 'mes' | 'ano'

const OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: 'mes', label: 'Mês' },
  { value: 'ano', label: 'Ano' },
]

/** Período da agenda: até dois meses (a API limita a 62 dias, PAG-02). */
export type AgendaPeriod = Exclude<Period, 'ano'>

/**
 * Seletor de período (7 dias / Mês / Ano). O estado vive no AppShell e vale para todas as telas.
 * `semAno` esconde "Ano" (agenda).
 */
export function PeriodSwitch({
  value,
  onChange,
  semAno = false,
}: {
  value: Period
  onChange: (p: Period) => void
  semAno?: boolean
}) {
  const options = semAno ? OPTIONS.filter((o) => o.value !== 'ano') : OPTIONS
  return <Seg label="Período" options={options} value={value} onChange={onChange} />
}
