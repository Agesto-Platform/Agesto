import type { FC } from 'react'
import type { TipoOperacao } from '../types/api'
import {
  IconGrid,
  IconFile,
  IconList,
  IconCalendar,
  IconUsers,
  IconUserKey,
  IconBox,
  IconWrench,
  IconChart,
  IconSettings,
  type IconProps,
} from '../components/icons'

export type NavItem = {
  to: string
  label: string
  icon: FC<IconProps>
  count?: number
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

/** Estrutura de navegação do painel do Dono (portada do protótipo). */
export const NAV: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { to: '/', label: 'Visão geral', icon: IconGrid },
      { to: '/atendimentos', label: 'Atendimentos', icon: IconFile },
      { to: '/orcamentos', label: 'Orçamentos', icon: IconList },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes', icon: IconUsers },
      { to: '/produtos', label: 'Produtos', icon: IconBox },
      { to: '/servicos', label: 'Serviços', icon: IconWrench },
      { to: '/usuarios', label: 'Usuários', icon: IconUserKey },
    ],
  },
  {
    label: 'Análise',
    items: [
      { to: '/relatorios', label: 'Relatórios', icon: IconChart },
      { to: '/parametrizacao', label: 'Parametrização', icon: IconSettings },
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

/** Lookup plano rota -> rótulo, para o título da topbar. */
export const NAV_TITLES: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items).map((i) => [i.to, i.label]),
)
