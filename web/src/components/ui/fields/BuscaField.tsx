import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { TAMANHO_BUSCA, useBuscaRapida, useDebounced, type Filtros } from '../../../lib/paginacao'

/**
 * Campo de escolha com busca no servidor (PAG-01 fase 2): no lugar de um <select>
 * com o cadastro inteiro, o Dono digita e escolhe entre as primeiras opções que a
 * API devolve. Guarda o item escolhido inteiro, para o formulário usar preço,
 * cobrança etc. sem baixar a lista.
 */
export function BuscaField<T extends { id: number }>({
  label,
  value,
  onChange,
  queryKey,
  path,
  rotulo,
  detalhe,
  filtros,
  error,
  hint,
  required = false,
  placeholder = 'Digite para buscar…',
  semResultado = 'Nada encontrado.',
}: {
  label: string
  value: T | null
  onChange: (item: T | null) => void
  queryKey: readonly unknown[]
  path: string
  rotulo: (item: T) => string
  detalhe?: (item: T) => string | undefined
  filtros?: Filtros
  error?: string
  hint?: string
  required?: boolean
  placeholder?: string
  semResultado?: string
}) {
  const id = useId()
  const listId = `${id}-opcoes`
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const fecharRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // O fechamento atrasado do onBlur não pode rodar depois que o campo saiu da
  // tela (em teste, isso acontecia depois do fim e quebrava o CI de vez em quando).
  useEffect(
    () => () => {
      if (fecharRef.current) clearTimeout(fecharRef.current)
    },
    [],
  )

  const termo = useDebounced(texto, 250)
  const busca = useBuscaRapida<T>(queryKey, path, termo, aberto, filtros)
  const opcoes = busca.data?.itens ?? []
  const total = busca.data?.total ?? 0

  // Com um item escolhido e sem edição, o campo mostra o nome dele.
  const exibido = aberto ? texto : value ? rotulo(value) : texto

  function escolher(item: T) {
    onChange(item)
    setTexto('')
    setAberto(false)
  }

  function abrir() {
    if (fecharRef.current) clearTimeout(fecharRef.current)
    setAtivo(0)
    setAberto(true)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!aberto) abrir()
      else setAtivo((i) => Math.min(i + 1, Math.max(opcoes.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (aberto && opcoes[ativo]) {
        e.preventDefault()
        escolher(opcoes[ativo])
      }
    } else if (e.key === 'Escape') {
      if (aberto) {
        e.preventDefault()
        setAberto(false)
        setTexto('')
      }
    }
  }

  const msgId = error || hint ? `${id}-msg` : undefined

  return (
    <div className="field busca-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={aberto}
        aria-controls={listId}
        aria-activedescendant={aberto && opcoes[ativo] ? `${listId}-${opcoes[ativo].id}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={msgId}
        placeholder={value ? undefined : placeholder}
        value={exibido}
        onFocus={abrir}
        onChange={(e) => {
          setTexto(e.target.value)
          setAtivo(0)
          if (!aberto) setAberto(true)
          // Apagar o texto de um item escolhido limpa a escolha.
          if (value && e.target.value === '') onChange(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Dá tempo do clique na opção chegar antes de fechar.
          fecharRef.current = setTimeout(() => {
            setAberto(false)
            setTexto('')
          }, 150)
        }}
      />
      {aberto && (
        <ul className="busca-pop" id={listId} role="listbox" aria-label={label}>
          {busca.isLoading && <li className="vazio">Buscando…</li>}
          {busca.isError && <li className="vazio">Não foi possível buscar. Tente de novo.</li>}
          {busca.isSuccess && opcoes.length === 0 && <li className="vazio">{semResultado}</li>}
          {opcoes.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              role="option"
              aria-selected={i === ativo}
              onMouseEnter={() => setAtivo(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(o)
              }}
            >
              <span>{rotulo(o)}</span>
              {detalhe?.(o) && <span className="sub">{detalhe(o)}</span>}
            </li>
          ))}
          {busca.isSuccess && total > TAMANHO_BUSCA && (
            <li className="vazio">
              Mostrando {TAMANHO_BUSCA} de {total}. Digite mais para refinar.
            </li>
          )}
        </ul>
      )}
      {(error || hint) && (
        <span id={msgId} className={error ? 'field-err' : 'hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
