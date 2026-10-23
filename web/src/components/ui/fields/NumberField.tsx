import { useId } from 'react'

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  prefix,
  step = 1,
  min = 0,
  required = false,
  placeholder,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  error?: string
  hint?: string
  prefix?: string
  step?: number
  min?: number
  required?: boolean
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      <div className={prefix ? 'input-affix' : undefined}>
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          className="input num"
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? id + '-msg' : undefined}
        />
      </div>
      {(error || hint) && (
        <span id={id + '-msg'} className={error ? 'field-err' : 'hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
