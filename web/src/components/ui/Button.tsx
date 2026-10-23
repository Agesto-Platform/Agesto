import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Icon, type IconName } from '../Icon'

type Variant = 'default' | 'primary' | 'accent' | 'ghost'
type Size = 'md' | 'sm'

function btnClass(variant: Variant, size: Size, className: string): string {
  return ['btn', variant !== 'default' && variant, size === 'sm' && 'sm', className]
    .filter(Boolean)
    .join(' ')
}

/** Botão do painel (`.btn`). `icon` entra antes do texto. */
export function Button({
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: IconName
  children: ReactNode
}) {
  return (
    <button type={type} className={btnClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

/** Mesmo visual do botão, para navegar entre telas. */
export function ButtonLink({
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  children,
  ...props
}: LinkProps & {
  variant?: Variant
  size?: Size
  icon?: IconName
  children: ReactNode
}) {
  return (
    <Link className={btnClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  )
}

/** Botão quadrado só com ícone (`.icon-btn`). Sempre com aria-label. */
export function IconButton({
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; 'aria-label': string }) {
  return (
    <button type={type} className={`icon-btn${className ? ' ' + className : ''}`} {...props}>
      {children}
    </button>
  )
}
