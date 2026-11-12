import { Icon } from '../components/Icon'

/** Campo de senha no padrão do login (`.lfield` + `.ibox` com cadeado). */
export function SenhaField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  autoFocus?: boolean
  hint?: string
}) {
  return (
    <div className="lfield">
      <label htmlFor={id}>{label}</label>
      <div className="ibox">
        <span>
          <Icon name="lock" />
        </span>
        <input
          className="input"
          id={id}
          type="password"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? id + '-hint' : undefined}
        />
      </div>
      {hint && (
        <span className="hint" id={id + '-hint'}>
          {hint}
        </span>
      )}
    </div>
  )
}
