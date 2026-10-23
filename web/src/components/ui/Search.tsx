import { Icon } from '../Icon'

/** Campo de busca (`.search`) com ícone, usado na barra de ferramentas dos cartões. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
