import type { LocalDb } from '@/db/types'
import type { Configuracao } from '@/types/api'

const META_KEY = 'config'

/**
 * Config padrão (segura) usada antes da primeira Carga ou se algo falhar:
 * modo Flexível (não limita o agente) e controle de estoque ligado.
 */
export const DEFAULT_CONFIG: Configuracao = {
  tipoOperacao: 'Servico',
  modoAgendaAgente: 'Flexivel',
  controlaEstoque: true,
  agenteCadastraServico: true,
}

/** Persiste a configuração da empresa (vinda da Carga) no banco local. */
export async function saveConfig(db: LocalDb, config: Configuracao): Promise<void> {
  await db.setMeta(META_KEY, JSON.stringify(config))
}

/** Lê a configuração local; devolve o default seguro se ausente ou inválida. */
export async function getConfig(db: LocalDb): Promise<Configuracao> {
  const raw = await db.getMeta(META_KEY)
  if (!raw) return DEFAULT_CONFIG
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Configuracao>) }
  } catch {
    return DEFAULT_CONFIG
  }
}
