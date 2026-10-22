import { Icon, type IconName } from '../Icon'

/** Alerta compacto (`.alert`): ícone + título + linha de apoio. */
export function Alert({
  tone,
  icon,
  title,
  subtitle,
}: {
  tone: 'neg' | 'warn'
  icon: IconName
  title: string
  subtitle?: string
}) {
  return (
    <div className={`alert${tone === 'neg' ? ' neg' : ''}`}>
      <Icon name={icon} />
      <div>
        <b>{title}</b>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  )
}
