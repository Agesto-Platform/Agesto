import type { LocalAtendimento } from './types'

/**
 * Troca o uuid de um serviço criado offline pelo id que o servidor atribuiu.
 * Devolve null quando o atendimento não usa esse serviço (nada a gravar).
 */
export function remapItensServico(
  a: LocalAtendimento,
  servicoUuid: string,
  servicoId: number,
): LocalAtendimento | null {
  if (!a.itensServico.some((i) => i.servicoUuid === servicoUuid)) return null
  return {
    ...a,
    itensServico: a.itensServico.map((i) =>
      i.servicoUuid === servicoUuid ? { servicoId, servicoUuid: null, quantidade: i.quantidade } : i,
    ),
  }
}
