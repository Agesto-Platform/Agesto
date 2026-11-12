import { Button } from './Button'

/**
 * Rodapé das listas paginadas (PAG-01): quantos estão na tela, de quantos, e o botão
 * para trazer os próximos. Some quando a lista cabe numa página só.
 */
export function CarregarMais({
  carregados,
  total,
  temMais,
  carregando,
  onClick,
  rotulo,
}: {
  carregados: number
  total: number
  temMais: boolean
  carregando: boolean
  onClick: () => void
  rotulo: string
}) {
  if (!temMais && carregados >= total) return null
  return (
    <div className="carregar-mais">
      <span className="hint">
        Mostrando {carregados} de {total} {rotulo}
      </span>
      {temMais && (
        <Button size="sm" onClick={onClick} disabled={carregando}>
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </Button>
      )}
    </div>
  )
}
