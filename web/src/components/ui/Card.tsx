import type { CSSProperties, ReactNode } from 'react'

/** Cartão do painel (`.card`). O conteúdo vai em <CardHead> e <CardBody>. */
export function Card({
  className = '',
  children,
  label,
}: {
  className?: string
  children: ReactNode
  /** Rótulo acessível quando o cartão não tem título visível. */
  label?: string
}) {
  return (
    <section className={`card${className ? ' ' + className : ''}`} aria-label={label}>
      {children}
    </section>
  )
}

/** Cabeçalho do cartão: título, subtítulo opcional e ações à direita. */
export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="card-head">
      <div>
        <h2 className="card-title">{title}</h2>
        {subtitle && <p className="card-sub">{subtitle}</p>}
      </div>
      {action && <div className="end">{action}</div>}
    </div>
  )
}

export function CardBody({
  className = '',
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div className={`card-body${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  )
}
