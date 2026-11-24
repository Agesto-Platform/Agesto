import { brl } from '../../components/ui/brl'
import type { ServicoReceitaItem } from '../../types/api'

const COBRANCA: Record<string, string> = { PorHora: 'Por hora', Hora: 'Por hora', Empreitada: 'Empreitada' }

/** "18 atendimentos · Empreitada · R$ 178/h · margem R$ 133/h" (as horas dependem da duração cadastrada). */
export function metaServico(s: ServicoReceitaItem): string {
  const partes = [`${s.quantidade} ${s.quantidade === 1 ? 'atendimento' : 'atendimentos'}`, COBRANCA[s.tipoCobranca] ?? s.tipoCobranca]
  if (s.receitaPorHora !== null) partes.push(`${brl(s.receitaPorHora)}/h`)
  if (s.margemPorHora !== null) partes.push(`margem ${brl(s.margemPorHora)}/h`)
  return partes.join(' · ')
}
