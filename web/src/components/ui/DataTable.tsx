import type { ReactNode } from 'react'
import { Empty } from './Empty'
import type { IconName } from '../Icon'

export interface Column<T> {
  header: ReactNode
  cell: (row: T) => ReactNode
  /** 'right' = coluna numérica (alinha à direita). */
  align?: 'left' | 'right'
  /** Classes da célula: 'wrap' (quebra linha), 'strong', 'muted'... */
  className?: string
}

/** Tabela do painel (`table.t`) dirigida por colunas, com carregando e vazio. */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  loading = false,
  empty = { title: 'Nada por aqui ainda.' },
  onRowClick,
  isSelected,
}: {
  columns: Column<T>[]
  rows: T[] | undefined
  getKey: (row: T) => string | number
  loading?: boolean
  empty?: { title: string; text?: ReactNode; icon?: IconName }
  /** Linha inteira clicável (abre o detalhe). */
  onRowClick?: (row: T) => void
  isSelected?: (row: T) => boolean
}) {
  const cls = (c: Column<T>) => [c.align === 'right' && 'n', c.className].filter(Boolean).join(' ') || undefined

  return (
    <>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={c.align === 'right' ? 'n' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
                  Carregando…
                </td>
              </tr>
            )}
            {!loading &&
              rows?.map((row) => (
                <tr
                  key={getKey(row)}
                  className={[onRowClick && 'row-click', isSelected?.(row) && 'is-selected'].filter(Boolean).join(' ') || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c, i) => (
                    <td key={i} className={cls(c)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && rows && rows.length === 0 && (
        <Empty icon={empty.icon} title={empty.title}>
          {empty.text}
        </Empty>
      )}
    </>
  )
}
