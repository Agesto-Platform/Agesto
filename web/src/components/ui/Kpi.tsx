import type { ReactNode } from 'react'
import { Icon, type IconName } from '../Icon'

/**
 * Número principal (`.card.kpi`): rótulo com ícone, valor grande e uma linha de apoio.
 * `tone="brand"` usa o ícone na cor da marca; o padrão usa a cor de destaque.
 */
export function Kpi({
  label,
  icon,
  tone = 'accent',
  value,
  foot,
}: {
  label: ReactNode
  icon: IconName
  tone?: 'accent' | 'brand'
  value: ReactNode
  foot?: ReactNode
}) {
  return (
    <section className="card kpi" aria-label={typeof label === 'string' ? label : undefined}>
      <div className="kpi-label">
        <span className={`ic${tone === 'brand' ? ' b' : ''}`}>
          <Icon name={icon} />
        </span>
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </section>
  )
}

/** Linha de números menores (`.stats`), separados por filetes. */
export function Stats({ items }: { items: { label: string; value: ReactNode; unit?: ReactNode }[] }) {
  return (
    <dl className="stats" style={{ margin: 0 }}>
      {items.map((s) => (
        <div className="stat" key={s.label}>
          <dt>{s.label}</dt>
          <dd>
            {s.value} {s.unit && <span>{s.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
