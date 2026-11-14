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
 * Seletor de período (7 dias / Mês / Ano). O estado vive no AppShell e vale para as telas
 * de análise; a Agenda navega mês a mês, sem ele.
 */
export function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return <Seg label="Período" options={OPTIONS} value={value} onChange={onChange} />
}
