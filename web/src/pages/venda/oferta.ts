/** Contato comercial e preços da página de venda (DEC-57). */

export const CONTATO = {
  whatsapp: '(34) 99632-6130',
  email: 'agesto.contact@gmail.com',
}

/**
 * Por mês: a assinatura dá o acesso do dono, com todos os recursos, e a licença
 * de um funcionário; cada funcionário a mais custa uma licença.
 */
export const PRECO = { assinatura: 49.9, licenca: 19.9, licencasInclusas: 1 }

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const reais = (v: number) => moeda.format(v).replace(/\s/g, ' ')

/** Licenças pagas à parte: os funcionários além dos que a assinatura já inclui. */
export function licencasExtras(funcionarios: number): number {
  return Math.max(0, funcionarios - PRECO.licencasInclusas)
}

/** Total do mês: a assinatura mais as licenças extras. */
export function totalMensal(funcionarios: number): number {
  return Math.round((PRECO.assinatura + licencasExtras(funcionarios) * PRECO.licenca) * 100) / 100
}
