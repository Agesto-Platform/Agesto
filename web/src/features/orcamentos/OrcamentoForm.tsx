import { useState, useEffect, type FormEvent } from 'react'
import type {
  Cliente,
  Produto,
  Servico,
  OrcamentoInput,
  StatusOrcamento,
} from '../../types/api'
import { Button, IconButton, NumberField, SelectField, TextField, brl } from '../../components/ui'
import { Icon, type IconName } from '../../components/Icon'
import { useServicoSugeridos } from '../servicos/sugeridosQueries'
import { useConfiguracao } from '../parametrizacao/queries'

type Tipo = 'produto' | 'servico' | 'avulso'

const TIPO: Record<Tipo, { icon: IconName; label: string }> = {
  servico: { icon: 'hammer', label: 'Serviço' },
  produto: { icon: 'box', label: 'Material' },
  avulso: { icon: 'pencil', label: 'Avulso' },
}

interface DraftItem {
  key: string
  produtoId: number | null
  servicoId: number | null
  descricao: string | null
  label: string
  quantidade: number
  precoUnitario: number
}

function servicoPreco(s: Servico): number | undefined {
  return s.valorHora ?? s.valorEmpreitada ?? undefined
}

export function OrcamentoForm({
  clientes,
  produtos,
  servicos,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  clientes: Cliente[]
  produtos: Produto[]
  servicos: Servico[]
  onSubmit: (input: OrcamentoInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [status, setStatus] = useState<StatusOrcamento>('Rascunho')
  const [itens, setItens] = useState<DraftItem[]>([])
  const [errors, setErrors] = useState<{ cliente?: string; itens?: string }>({})

  // rascunho do item em edição
  const [tipo, setTipo] = useState<Tipo>('produto')
  const [refId, setRefId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState<number | undefined>(1)
  const [preco, setPreco] = useState<number | undefined>(undefined)
  const [draftError, setDraftError] = useState<string | null>(null)

  const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)

  const permiteServico = (useConfiguracao().data?.tipoOperacao ?? 'Hibrido') !== 'Venda'
  useEffect(() => {
    if (!permiteServico && tipo === 'servico') changeTipo('produto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permiteServico])

  const servicoSelId = tipo === 'servico' && refId ? Number(refId) : 0
  const sugeridos = useServicoSugeridos(servicoSelId)

  function addSugeridos() {
    const list = sugeridos.data ?? []
    setItens((prev) => [
      ...prev,
      ...list
        .filter((s) => !prev.some((i) => i.produtoId === s.produtoId))
        .map((s) => {
          const p = produtos.find((x) => x.id === s.produtoId)
          return {
            key: crypto.randomUUID(),
            produtoId: s.produtoId,
            servicoId: null,
            descricao: null,
            label: p?.nome ?? s.produtoNome,
            quantidade: s.quantidadePadrao,
            precoUnitario: p?.preco ?? 0,
          }
        }),
    ])
  }

  function changeTipo(t: Tipo) {
    setTipo(t)
    setRefId('')
    setDescricao('')
    setPreco(undefined)
    setDraftError(null)
  }

  function pickProduto(id: string) {
    setRefId(id)
    setPreco(produtos.find((p) => p.id === Number(id))?.preco)
  }
  function pickServico(id: string) {
    setRefId(id)
    const s = servicos.find((x) => x.id === Number(id))
    setPreco(s ? servicoPreco(s) : undefined)
  }

  function addItem() {
    setDraftError(null)
    if (!quantidade || quantidade < 1) return setDraftError('Quantidade inválida.')
    if (preco === undefined || preco < 0) return setDraftError('Preço inválido.')

    let produtoId: number | null = null
    let servicoId: number | null = null
    let desc: string | null = null
    let label = ''

    if (tipo === 'produto') {
      if (!refId) return setDraftError('Escolha um produto.')
      produtoId = Number(refId)
      label = produtos.find((p) => p.id === produtoId)?.nome ?? 'Produto'
    } else if (tipo === 'servico') {
      if (!refId) return setDraftError('Escolha um serviço.')
      servicoId = Number(refId)
      label = servicos.find((s) => s.id === servicoId)?.descricao ?? 'Serviço'
    } else {
      if (!descricao.trim()) return setDraftError('Descreva o item avulso.')
      desc = descricao.trim()
      label = desc
    }

    setItens((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        produtoId,
        servicoId,
        descricao: desc,
        label,
        quantidade,
        precoUnitario: preco,
      },
    ])
    setRefId('')
    setDescricao('')
    setQuantidade(1)
    setPreco(undefined)
  }

  function removeItem(key: string) {
    setItens((prev) => prev.filter((i) => i.key !== key))
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e: { cliente?: string; itens?: string } = {}
    if (!clienteId) e.cliente = 'Selecione um cliente.'
    if (itens.length === 0) e.itens = 'Adicione ao menos um item.'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    onSubmit({
      clienteId: Number(clienteId),
      status,
      itens: itens.map((i) => ({
        produtoId: i.produtoId,
        servicoId: i.servicoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {serverError}
          </p>
        )}

        <SelectField
          label="Cliente"
          required
          value={clienteId}
          onChange={setClienteId}
          error={errors.cliente}
          options={[
            { value: '', label: 'Selecione…' },
            ...clientes.map((c) => ({ value: String(c.id), label: c.nome })),
          ]}
        />

        <SelectField
          label="Status inicial"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'Rascunho', label: 'Rascunho' },
            { value: 'Enviado', label: 'Enviado' },
          ]}
        />

        {/* Itens adicionados */}
        <span className="section-label">Itens</span>
        {itens.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Nenhum item ainda.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="n">Qtd.</th>
                  <th className="n">Subtotal</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => {
                  const t = TIPO[i.servicoId != null ? 'servico' : i.produtoId != null ? 'produto' : 'avulso']
                  return (
                    <tr key={i.key}>
                      <td className="wrap">
                        <div className="cell">
                          <span className="cell-ic">
                            <Icon name={t.icon} />
                          </span>
                          <span>
                            <span className="strong">{i.label}</span>
                            <span className="sub">
                              {t.label} · {brl(i.precoUnitario, true)} un.
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="n">{i.quantidade}</td>
                      <td className="n strong">{brl(i.quantidade * i.precoUnitario, true)}</td>
                      <td className="n">
                        <IconButton
                          aria-label={`Remover ${i.label}`}
                          style={{ width: 28, height: 28 }}
                          onClick={() => removeItem(i.key)}
                        >
                          <Icon name="x" />
                        </IconButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {errors.itens && (
          <span className="field-err" role="alert">
            {errors.itens}
          </span>
        )}

        {/* Adicionar item */}
        <span className="section-label">Adicionar item</span>
        <SelectField
          label="Tipo"
          value={tipo}
          onChange={changeTipo}
          options={[
            { value: 'produto', label: 'Produto (catálogo)' },
            ...(permiteServico ? [{ value: 'servico' as const, label: 'Serviço (catálogo)' }] : []),
            { value: 'avulso', label: 'Item avulso' },
          ]}
        />
        {tipo === 'produto' && (
          <SelectField
            label="Produto"
            value={refId}
            onChange={pickProduto}
            options={[
              { value: '', label: 'Escolha o produto…' },
              ...produtos.map((p) => ({ value: String(p.id), label: p.nome })),
            ]}
          />
        )}
        {tipo === 'servico' && (
          <SelectField
            label="Serviço"
            value={refId}
            onChange={pickServico}
            options={[
              { value: '', label: 'Escolha o serviço…' },
              ...servicos.map((s) => ({ value: String(s.id), label: s.descricao })),
            ]}
          />
        )}
        {tipo === 'servico' && servicoSelId > 0 && (sugeridos.data?.length ?? 0) > 0 && (
          <div className="field">
            <span className="label">Materiais sugeridos ({sugeridos.data!.length})</span>
            <span className="hint">
              {sugeridos.data!.map((s) => `${s.produtoNome} ×${s.quantidadePadrao}`).join(' · ')}
            </span>
            <div>
              <Button size="sm" icon="plus" onClick={addSugeridos}>
                Adicionar sugeridos
              </Button>
            </div>
          </div>
        )}
        {tipo === 'avulso' && (
          <TextField
            label="Descrição"
            value={descricao}
            onChange={setDescricao}
            placeholder="Descrição do item"
            maxLength={200}
          />
        )}
        <div className="form-row">
          <NumberField label="Qtd." step={1} value={quantidade} onChange={setQuantidade} />
          <NumberField label="Preço unit." prefix="R$" step={0.01} value={preco} onChange={setPreco} />
        </div>
        {draftError && (
          <span className="field-err" role="alert">
            {draftError}
          </span>
        )}
        <div>
          <Button icon="plus" onClick={addItem}>
            Adicionar item
          </Button>
        </div>

        <dl className="kv" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <dt>Total</dt>
          <dd style={{ fontWeight: 600, fontSize: 15 }}>{brl(total, true)}</dd>
        </dl>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Criar orçamento'}
        </Button>
      </div>
    </form>
  )
}
