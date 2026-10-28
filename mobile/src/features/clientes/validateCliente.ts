import { onlyDigits } from '@/lib/masks'

export interface ClienteFormErrors {
  nome?: string
  cpf?: string
}

/**
 * CPF com dígitos verificadores, igual ao `ClienteService.NormalizeCpf` da API:
 * 11 dígitos, não repetidos (111.111.111-11) e os dois verificadores corretos.
 * Aceita com ou sem máscara.
 */
export function cpfValido(cpf: string): boolean {
  const d = onlyDigits(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (ate: number): number => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/** Validação do cadastro rápido de cliente (espelha as regras do backend). */
export function validateCliente(input: { nome: string; cpf: string }): ClienteFormErrors {
  const e: ClienteFormErrors = {}
  const nome = input.nome.trim()
  if (nome.length < 2) e.nome = 'Nome deve ter no mínimo 2 caracteres.'
  else if (nome.length > 120) e.nome = 'Nome deve ter no máximo 120 caracteres.'
  if (onlyDigits(input.cpf).length !== 11) e.cpf = 'CPF deve ter 11 dígitos.'
  else if (!cpfValido(input.cpf)) e.cpf = 'CPF inválido. Confira os números.'
  return e
}

export const isValid = (e: ClienteFormErrors): boolean => Object.keys(e).length === 0
