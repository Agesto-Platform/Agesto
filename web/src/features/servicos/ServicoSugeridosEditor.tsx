import { useEffect, useMemo, useState } from 'react'
import { produtosResource } from '../produtos/resource'
import { useServicoSugeridos, useUpdateServicoSugeridos } from './sugeridosQueries'
import { Button, Empty, IconButton, SelectField, useToast } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import type { ServicoSugeridoInput } from '../../types/api'

function norm(rows: ServicoSugeridoInput[]): string {
  return JSON.stringify([...rows].sort((a, b) => a.produtoId - b.produtoId))
}

/** Editor do kit de materiais de um serviço (só ao editar um serviço existente). */
export function ServicoSugeridosEditor({ servicoId }: { servicoId: number }) {
  const produtos = produtosResource.useList()
  const sugeridos = useServicoSugeridos(servicoId)
  const update = useUpdateServicoSugeridos(servicoId)
  const toast = useToast()

  const [rows, setRows] = useState<ServicoSugeridoInput[]>([])
  const [addId, setAddId] = useState('')

  const serverRows = useMemo(
    () => (sugeridos.data ?? []).map((s) => ({ produtoId: s.produtoId, quantidadePadrao: s.quantidadePadrao })),
    [sugeridos.data],
  )

  const nomeDe = (id: number) => produtos.data?.find((p) => p.id === id)?.nome ?? `Produto #${id}`
  const disponiveis = (produtos.data ?? []).filter((p) => !rows.some((r) => r.produtoId === p.id))
  const dirty = norm(rows) !== norm(serverRows)

  // Sincroniza com o servidor só quando não há edição pendente (não clobbera o usuário).
  useEffect(() => {
    if (!dirty) setRows(serverRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRows])

  function add(produtoId: number) {
    if (!produtoId || rows.some((r) => r.produtoId === produtoId)) return
    setRows((r) => [...r, { produtoId, quantidadePadrao: 1 }])
    setAddId('')
  }

  function setQtd(produtoId: number, quantidadePadrao: number) {
    setRows((r) => r.map((x) => (x.produtoId === produtoId ? { ...x, quantidadePadrao } : x)))
  }

  function remove(produtoId: number) {
    setRows((r) => r.filter((x) => x.produtoId !== produtoId))
  }

  function salvar() {
    update.mutate(
      rows.filter((r) => r.quantidadePadrao > 0),
      {
        onSuccess: () => toast.success('Kit de materiais salvo.'),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
      },
    )
  }

  return (
    <div className="form" style={{ borderTop: '1px solid var(--line)' }}>
      <div>
        <div className="section-label">Kit de materiais sugeridos</div>
        <p className="hint" style={{ margin: '4px 0 0' }}>
          Entram sozinhos no orçamento quando você escolhe este serviço.
        </p>
      </div>

      {sugeridos.isLoading && (
        <p className="hint" style={{ margin: 0 }}>
          Carregando…
        </p>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Material</th>
                <th className="n">Qtd.</th>
                <th>
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.produtoId}>
                  <td>
                    <div className="cell">
                      <span className="cell-ic">
                        <Icon name="box" />
                      </span>
                      <span className="strong">{nomeDe(r.produtoId)}</span>
                    </div>
                  </td>
                  <td className="n">
                    <input
                      className="input num"
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={0}
                      value={r.quantidadePadrao}
                      onChange={(e) => setQtd(r.produtoId, e.target.value === '' ? 0 : Number(e.target.value))}
                      aria-label={`Quantidade de ${nomeDe(r.produtoId)}`}
                      style={{ width: 72, textAlign: 'right' }}
                    />
                  </td>
                  <td className="n">
                    <IconButton onClick={() => remove(r.produtoId)} aria-label={`Remover ${nomeDe(r.produtoId)}`}>
                      <Icon name="x" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !sugeridos.isLoading && (
        <Empty icon="box" title="Nenhum material no kit" style={{ padding: '8px 0' }}>
          Ex.: suporte, gás e cano de dreno para uma instalação. Você monta uma vez e reaproveita sempre.
        </Empty>
      )}

      {disponiveis.length > 0 && (
        <SelectField<string>
          label="Adicionar material"
          value={addId}
          onChange={(v) => {
            setAddId(v)
            if (v) add(Number(v))
          }}
          options={[
            { value: '', label: 'Selecione um produto…' },
            ...disponiveis.map((p) => ({ value: String(p.id), label: p.nome })),
          ]}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={salvar} disabled={!dirty || update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar kit'}
        </Button>
      </div>
    </div>
  )
}
