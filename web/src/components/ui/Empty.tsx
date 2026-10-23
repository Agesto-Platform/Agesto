import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from '../Icon'

/** Estado vazio (`.empty`): ícone, frase em negrito e uma explicação curta. */
export function Empty({
  icon = 'search',
  title,
  children,
  style,
}: {
  icon?: IconName
  title: string
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="empty" style={style}>
      <span className="ic">
        <Icon name={icon} />
      </span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  )
}
