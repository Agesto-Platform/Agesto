import type { ReactNode } from 'react'

/** Controle segmentado (`.seg`): uma opção ativa entre poucas. */
export function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  label: string
  options: { value: T; label: ReactNode; ariaLabel?: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`seg${className ? ' ' + className : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
