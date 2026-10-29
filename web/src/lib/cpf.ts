import { onlyDigits } from './masks'

/**
 * CPF com dígitos verificadores, igual ao `ClienteService.NormalizeCpf` da API e
 * ao `cpfValido` do app: 11 dígitos, não repetidos (111.111.111-11) e os dois
 * verificadores corretos. Aceita com ou sem máscara.
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
