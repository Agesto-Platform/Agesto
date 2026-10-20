import type { ServicoInput, TipoCobranca } from '@/types/api'

export interface ServicoFormErrors {
  descricao?: string
  valor?: string
}

/** Valor digitado no app ("150", "150,50", "1.250,00") para número; null se inválido. */
export function parseValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, '')
  if (!limpo) return null
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null
  return Number(normalizado)
}

/** Validação do cadastro rápido de serviço (espelha ServicoSyncRequest do backend). */
export function validateServico(input: { descricao: string; valor: string }): ServicoFormErrors {
  const e: ServicoFormErrors = {}
  const descricao = input.descricao.trim()
  if (descricao.length < 2) e.descricao = 'Descrição deve ter no mínimo 2 caracteres.'
  else if (descricao.length > 200) e.descricao = 'Descrição deve ter no máximo 200 caracteres.'
  const valor = parseValor(input.valor)
  if (valor === null || valor < 0.01 || valor > 999999.99) e.valor = 'Informe um valor válido.'
  return e
}

/** Monta o serviço no formato do backend: só o valor do tipo de cobrança escolhido. */
export function toServicoInput(descricao: string, tipoCobranca: TipoCobranca, valor: number): ServicoInput {
  return {
    descricao: descricao.trim(),
    tipoCobranca,
    valorHora: tipoCobranca === 'PorHora' ? valor : null,
    valorEmpreitada: tipoCobranca === 'Empreitada' ? valor : null,
  }
}
