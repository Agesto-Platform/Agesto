import type { ReactNode } from 'react'

/** Cabeçalho da tela: título, frase de apoio e ações à direita. */
export function PageHead({
  title,
  sub,
  badge,
  actions,
}: {
  title: string
  sub?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-head">
      <div className="titles">
        <h1 className="page-title">
          {title}
          {badge}
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
