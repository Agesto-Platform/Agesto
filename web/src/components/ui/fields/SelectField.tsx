import { useId } from 'react'

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required = false,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  error?: string
  hint?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? id + '-msg' : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {(error || hint) && (
        <span id={id + '-msg'} className={error ? 'field-err' : 'hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
