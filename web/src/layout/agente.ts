/** Telas largas (calendário, relatórios) abrem com o Agente fechado, como nos templates. */
const SEM_AGENTE = ['/agenda', '/relatorios']

const AGENTE_KEY = 'agesto-agente'

export type EscolhaAgente = 'open' | 'closed' | null

/** Última escolha no botão do Agente (null = o usuário ainda não escolheu). */
export function lerEscolhaAgente(): EscolhaAgente {
  try {
    const v = localStorage.getItem(AGENTE_KEY)
    return v === 'open' || v === 'closed' ? v : null
  } catch {
    return null
  }
}

export function salvarEscolhaAgente(aberto: boolean): void {
  try {
    localStorage.setItem(AGENTE_KEY, aberto ? 'open' : 'closed')
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Estado do Agente ao entrar numa tela: só abre sozinho em janela larga, fora das
 * telas largas, e se o usuário não o recolheu (a escolha vale para todas as telas).
 */
export function agenteAbreNa(rota: string, largo: boolean, escolha: EscolhaAgente): boolean {
  return largo && !SEM_AGENTE.includes(rota) && escolha !== 'closed'
}
