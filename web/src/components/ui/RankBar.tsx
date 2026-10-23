import type { ReactNode } from 'react'

/** Linha de ranking (`.bar-row`): nome, valor, meta e barra proporcional. */
export function RankBar({
  name,
  meta,
  percent,
  amount,
  hi = false,
}: {
  name: string
  meta?: string
  percent: number
  amount: ReactNode
  /** Barra na cor de destaque (ex.: produtos). */
  hi?: boolean
}) {
  const width = Math.max(0, Math.min(100, percent))
  return (
    <div className="bar-row">
      <div className="top">
        <span className="name">{name}</span>
        <span className="val">{amount}</span>
      </div>
      {meta && <div className="meta">{meta}</div>}
      <div className={`track animate${hi ? ' hi' : ''}`}>
        <i style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

/** Lista de rankings (`.bars`). */
export function RankList({ children }: { children: ReactNode }) {
  return <div className="bars">{children}</div>
}
