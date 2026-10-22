import { useId, type HTMLInputTypeAttribute } from 'react'

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  placeholder,
  required = false,
  maxLength,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: HTMLInputTypeAttribute
  placeholder?: string
  required?: boolean
  maxLength?: number
  autoComplete?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? id + '-msg' : undefined}
      />
      {(error || hint) && (
        <span id={id + '-msg'} className={error ? 'field-err' : 'hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
