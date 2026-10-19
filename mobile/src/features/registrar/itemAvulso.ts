import { parseValor } from '@/features/servicos/validateServico'

/** Item fora do catálogo lançado no atendimento (não mexe no estoque), como o avulso do web. */
export interface ItemAvulso {
  descricao: string
  quantidade: number
  precoUnitario: number
}

export interface ItemAvulsoErrors {
  descricao?: string
  quantidade?: string
  valor?: string
}

/** Validação do item avulso (espelha ItemProdutoSyncRequest do backend). */
export function validateItemAvulso(input: { descricao: string; quantidade: string; valor: string }): ItemAvulsoErrors {
  const e: ItemAvulsoErrors = {}
  const descricao = input.descricao.trim()
  if (descricao.length < 2) e.descricao = 'Descreva o item avulso.'
  else if (descricao.length > 200) e.descricao = 'Descrição deve ter no máximo 200 caracteres.'
  const qtd = Number(input.quantidade.trim())
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 9999) e.quantidade = 'Informe a quantidade.'
  const valor = parseValor(input.valor)
  if (valor === null || valor > 999999.99) e.valor = 'Informe um valor válido.'
  return e
}

/** Monta o item a partir do formulário já validado. */
export function toItemAvulso(input: { descricao: string; quantidade: string; valor: string }): ItemAvulso {
  return {
    descricao: input.descricao.trim(),
    quantidade: Number(input.quantidade.trim()),
    precoUnitario: parseValor(input.valor) ?? 0,
  }
}
