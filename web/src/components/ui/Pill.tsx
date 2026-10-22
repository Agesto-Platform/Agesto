import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '../Icon'

export type BadgeTone = 'ok' | 'warn' | 'neg' | 'info' | 'brand' | 'future' | 'neutral'

/** Selo (`.badge`): status, contagem ou marcação. */
export function Badge({
  tone = 'neutral',
  icon,
  dot = false,
  className = '',
  style,
  children,
}: {
  tone?: BadgeTone
  icon?: IconName
  dot?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const cls = ['badge', tone !== 'neutral' && tone, dot && 'dot', className].filter(Boolean).join(' ')
  return (
    <span className={cls} style={style}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  )
}

type PillTone = 'ok' | 'pend' | 'brand' | 'bad'
const PILL: Record<PillTone, BadgeTone> = { ok: 'ok', pend: 'warn', brand: 'brand', bad: 'neg' }

/** Compatibilidade: tons antigos (ok/pend/brand/bad) no selo novo. */
export function Pill({ tone = 'brand', children }: { tone?: PillTone; children: ReactNode }) {
  return <Badge tone={PILL[tone]}>{children}</Badge>
}

/** Variação de um número (sobe/desce). */
export function Delta({ dir, children }: { dir: 'up' | 'down'; children: ReactNode }) {
  return (
    <Badge tone={dir === 'up' ? 'ok' : 'neg'} icon={dir === 'up' ? 'trend' : 'down'}>
      {children}
    </Badge>
  )
}
