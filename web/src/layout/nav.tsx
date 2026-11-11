import type { TipoOperacao } from '../types/api'
import type { IconName } from '../components/Icon'

export type NavItem = {
  to: string
  label: string
  icon: IconName
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/**
 * Estrutura de navegação do painel do Dono, na ordem do passo a passo:
 * primeiro cadastrar (cliente, serviço, material), depois operar no ciclo do
 * serviço (orçamento → agenda → atendimento, DEC-15) e por fim analisar.
 * "Visão geral" (/) fica sempre no topo da sidebar, fora dos grupos.
 */
export const NAV: NavGroup[] = [
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: 'users' },
      { to: '/servicos', label: 'Serviços', icon: 'hammer' },
      { to: '/produtos', label: 'Produtos', icon: 'box' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/', label: 'Visão geral', icon: 'pie' },
      { to: '/orcamentos', label: 'Orçamentos', icon: 'file' },
      { to: '/agenda', label: 'Agenda', icon: 'calendar' },
      { to: '/atendimentos', label: 'Atendimentos', icon: 'wrench' },
    ],
  },
  {
    label: 'Análise',
    items: [{ to: '/relatorios', label: 'Relatórios', icon: 'chart' }],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/usuarios', label: 'Usuários', icon: 'user' },
      { to: '/parametrizacao', label: 'Parametrização', icon: 'sliders' },
    ],
  },
]

/**
 * Rotas ocultas por modo de operação. Produto NUNCA some — é material/estoque,
 * não "venda" (DEC-18). No modo Venda (varejo puro) somem Serviços e Agenda.
 */
const OCULTAS_POR_MODO: Record<TipoOperacao, string[]> = {
  Servico: [],
  Venda: ['/servicos', '/agenda'],
  Hibrido: [],
}

/** Navegação filtrada pelo TipoOperacao da empresa (grupos vazios somem). */
export function navVisivel(tipo: TipoOperacao | undefined): NavGroup[] {
  const ocultas = tipo ? OCULTAS_POR_MODO[tipo] : []
  if (ocultas.length === 0) return NAV
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !ocultas.includes(i.to)) })).filter(
    (g) => g.items.length > 0,
  )
}

/**
 * Rota -> grupo e rótulo, para a trilha do topo. A Visão geral (/) fica fora
 * dos grupos na sidebar, então a trilha dela não tem grupo.
 */
export const NAV_LOOKUP: Record<string, { grupo?: string; label: string }> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.to, { grupo: i.to === '/' ? undefined : g.label, label: i.label }])),
)
