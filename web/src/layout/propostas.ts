import { api } from '../lib/api'
import { dataCurta, hora } from '../lib/format'
import { queryClient } from '../lib/queryClient'
import type { AcaoAtendimento, Atendimento, AtendimentoUpdate } from '../types/api'

/**
 * Fase 2 da IA (DEC-62): a IA só propõe; quem grava é o Dono, pelo cartão do painel,
 * com a mesma rota e as mesmas regras da tela de Atendimentos.
 */

/** "27 nov., 14:30" ou "sem data". */
function quando(iso: string | null): string {
  return iso ? `${dataCurta(iso)}, ${hora(iso)}` : 'sem data'
}

/** O que muda, em linhas curtas para o cartão. */
export function mudancas(a: AcaoAtendimento): string[] {
  const linhas: string[] = []
  if (a.novoStatus === 'Concluido') linhas.push('Concluir o atendimento')
  if (a.novoStatus === 'Cancelado') linhas.push('Cancelar o atendimento (o estoque dos itens volta)')
  if (a.novaData) linhas.push(`Data: ${quando(a.dataAtual)} → ${quando(a.novaData)}`)
  if (a.novoResponsavelId !== null)
    linhas.push(`Responsável: ${a.responsavelAtualNome ?? 'sem nome'} → ${a.novoResponsavelNome ?? 'sem nome'}`)
  return linhas
}

/** O atendimento mudou entre a sugestão e o clique: não grava por cima. */
export class PropostaDesatualizada extends Error {}

const mesmoInstante = (x: string | null, y: string | null) =>
  (x ? new Date(x).getTime() : null) === (y ? new Date(y).getTime() : null)

/**
 * Relê o atendimento e, se ele ainda estiver como na proposta (pendente, mesma data
 * e mesmo responsável), grava a mudança pelo PUT de sempre.
 */
export async function aplicarProposta(a: AcaoAtendimento): Promise<Atendimento> {
  const atual = await api.get<Atendimento>(`/api/atendimento/${a.atendimentoId}`)
  if (atual.status !== 'Pendente' || !mesmoInstante(atual.dataAgendada, a.dataAtual) || atual.usuarioId !== a.responsavelAtualId)
    throw new PropostaDesatualizada('Este atendimento mudou depois da sugestão. Peça de novo ao Agente.')

  const corpo: AtendimentoUpdate = {
    status: a.novoStatus ?? 'Pendente',
    dataAgendada: a.novaData ?? atual.dataAgendada,
    responsavelId: a.novoResponsavelId ?? atual.usuarioId,
  }
  const salvo = await api.put<Atendimento>(`/api/atendimento/${a.atendimentoId}`, corpo)
  // Listas, agenda e painel mostram o atendimento: recarregam.
  void queryClient.invalidateQueries({ queryKey: ['atendimento'] })
  void queryClient.invalidateQueries({ queryKey: ['agenda'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  return salvo
}
