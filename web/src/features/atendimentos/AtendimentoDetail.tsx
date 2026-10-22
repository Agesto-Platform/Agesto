import { useState, useEffect } from 'react'
import {
  useItemProdutos,
  useItemServicos,
  useAddItemProduto,
  useAddItemServico,
  useRemoveItemProduto,
  useRemoveItemServico,
} from './queries'
import { StatusAtendimentoPill } from './status'
import {
  Button,
  IconButton,
  NumberField,
  SelectField,
  TextField,
  brl,
  useToast,
} from '../../components/ui'
import { Icon, type IconName } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { dataCurta, hora } from '../../lib/format'
import { useConfiguracao } from '../parametrizacao/queries'
import { useServicoSugeridos, useUpdateServicoSugeridos } from '../servicos/sugeridosQueries'
import type { Atendimento, Produto, Servico, StatusAtendimento, Usuario } from '../../types/api'

type Tipo = 'produto' | 'servico' | 'avulso'

const STATUS_OPCOES: { value: StatusAtendimento; label: string }[] = [
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Concluido', label: 'Concluído' },
  { value: 'Cancelado', label: 'Cancelado' },
]

const TIPO: Record<Tipo, { icon: IconName; label: string }> = {
  servico: { icon: 'hammer', label: 'Serviço' },
  produto: { icon: 'box', label: 'Material' },
  avulso: { icon: 'pencil', label: 'Avulso' },
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function AtendimentoDetail({
  atendimento,
  responsaveis,
  produtos,
  servicos,
  onUpdate,
  onDelete,
  busy,
}: {
  atendimento: Atendimento
  responsaveis: Usuario[]
  produtos: Produto[]
  servicos: Servico[]
  onUpdate: (status: StatusAtendimento, dataAgendada: string | null, responsavelId: number) => void
  onDelete: () => void
  busy: { update: boolean; delete: boolean }
}) {
  const at = atendimento
  const prods = useItemProdutos(at.id)
  const servs = useItemServicos(at.id)
  const addProd = useAddItemProduto(at.id)
  const addServ = useAddItemServico(at.id)
  const rmProd = useRemoveItemProduto(at.id)
  const rmServ = useRemoveItemServico(at.id)
  const toast = useToast()
  const config = useConfiguracao().data
  const controlaEstoque = config?.controlaEstoque ?? true
  const permiteServico = (config?.tipoOperacao ?? 'Hibrido') !== 'Venda'

  const [status, setStatus] = useState<StatusAtendimento>(at.status)
  const [agenda, setAgenda] = useState(toLocalInput(at.dataAgendada))
  const [responsavel, setResponsavel] = useState(String(at.usuarioId))
  // O responsável atual pode estar desativado: continua na lista para não sumir do select.
  const opcoesResponsavel = responsaveis.filter((u) => u.ativo || u.id === at.usuarioId)
  const responsavelAtual = responsaveis.find((u) => u.id === at.usuarioId)?.nome ?? '—'

  const [tipo, setTipo] = useState<Tipo>('produto')
  const [refId, setRefId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [qtd, setQtd] = useState<number | undefined>(1)
  const [preco, setPreco] = useState<number | undefined>(undefined)
  const [custo, setCusto] = useState<number | undefined>(undefined)
  const [draftError, setDraftError] = useState<string | null>(null)

  // Materiais sugeridos do serviço selecionado no formulário de adicionar item.
  const servicoSelId = tipo === 'servico' && refId ? Number(refId) : 0
  const sugeridos = useServicoSugeridos(servicoSelId)

  // kit-04: salvar os materiais deste atendimento como sugeridos de um serviço.
  const [alvoServicoId, setAlvoServicoId] = useState(0)
  const materiaisDoAtendimento = (prods.data ?? [])
    .filter((p) => p.produtoId != null)
    .map((p) => ({ produtoId: p.produtoId as number, quantidadePadrao: p.quantidade }))
  const servicosDoAtendimento = [...new Set((servs.data ?? []).map((s) => s.servicoId))]
  const alvo = alvoServicoId || servicosDoAtendimento[0] || 0
  const salvarSugeridos = useUpdateServicoSugeridos(alvo)

  // Modo Venda não oferece serviço: garante um tipo válido se a config chegar depois.
  useEffect(() => {
    if (!permiteServico && tipo === 'servico') changeTipo('produto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permiteServico])

  function changeTipo(t: Tipo) {
    setTipo(t)
    setRefId('')
    setDescricao('')
    setPreco(undefined)
    setCusto(undefined)
    setDraftError(null)
  }
  function pickProduto(id: string) {
    setRefId(id)
    setPreco(produtos.find((p) => p.id === Number(id))?.preco)
  }
  function pickServico(id: string) {
    setRefId(id)
    const s = servicos.find((x) => x.id === Number(id))
    setPreco(s?.valorHora ?? s?.valorEmpreitada ?? undefined)
  }

  function resetDraft() {
    setRefId('')
    setDescricao('')
    setQtd(1)
    setPreco(undefined)
    setCusto(undefined)
  }

  function addItem() {
    setDraftError(null)
    if (!qtd || qtd < 1) return setDraftError('Quantidade inválida.')
    const onError = (e: unknown) =>
      setDraftError(e instanceof ApiError ? e.message : 'Não foi possível adicionar.')

    if (tipo === 'servico') {
      if (!refId) return setDraftError('Escolha um serviço.')
      // Empreitada não multiplica pela quantidade (DEC-04): cada unidade vira uma linha.
      const empreitada = servicos.find((s) => s.id === Number(refId))?.tipoCobranca === 'Empreitada'
      if (empreitada && qtd > 20) return setDraftError('Na empreitada, adicione até 20 unidades por vez.')
      const linhas = empreitada ? qtd : 1
      const body = { atendimentoId: at.id, servicoId: Number(refId), precoUnitario: preco ?? null, quantidade: empreitada ? 1 : qtd }
      // Uma de cada vez: cada inclusão recalcula o total do atendimento no servidor.
      void (async () => {
        try {
          for (let i = 0; i < linhas; i++) await addServ.mutateAsync(body)
          toast.success(linhas > 1 ? `${linhas} itens adicionados.` : 'Item adicionado.')
          resetDraft()
        } catch (e) {
          onError(e)
        }
      })()
      return
    }

    if (preco === undefined || preco < 0) return setDraftError('Preço inválido.')
    let produtoId: number | null = null
    let desc: string | null = null
    if (tipo === 'produto') {
      if (!refId) return setDraftError('Escolha um produto.')
      produtoId = Number(refId)
    } else {
      if (!descricao.trim()) return setDraftError('Descreva o item avulso.')
      desc = descricao.trim()
    }
    addProd.mutate(
      { atendimentoId: at.id, produtoId, descricao: desc, precoUnitario: preco, custo: custo ?? null, quantidade: qtd },
      { onSuccess: () => { toast.success('Item adicionado.'); resetDraft() }, onError },
    )
  }

  function addSugeridos() {
    const list = sugeridos.data ?? []
    for (const s of list) {
      const p = produtos.find((x) => x.id === s.produtoId)
      addProd.mutate({
        atendimentoId: at.id,
        produtoId: s.produtoId,
        descricao: null,
        precoUnitario: p?.preco ?? 0,
        custo: null,
        quantidade: s.quantidadePadrao,
      })
    }
    if (list.length > 0) toast.success(`${list.length} material(is) adicionado(s).`)
  }

  function salvarComoSugeridos() {
    if (alvo <= 0 || materiaisDoAtendimento.length === 0) return
    salvarSugeridos.mutate(materiaisDoAtendimento, {
      onSuccess: () => toast.success('Materiais salvos como sugeridos do serviço.'),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível salvar.'),
    })
  }

  const removido = { onSuccess: () => toast.success('Item removido.'), onError: () => toast.error('Falha ao remover.') }
  const itensLoading = prods.isLoading || servs.isLoading
  const itens: ItemLinha[] = [
    ...(servs.data ?? []).map((it) => ({
      key: `s${it.id}`,
      tipo: 'servico' as const,
      label: servicos.find((s) => s.id === it.servicoId)?.descricao ?? 'Serviço',
      qtd: it.quantidade,
      preco: it.precoUnitario,
      subtotal: it.subtotal,
      custo: null,
      onRemove: () => rmServ.mutate(it.id, removido),
    })),
    ...(prods.data ?? []).map((it) => ({
      key: `p${it.id}`,
      tipo: (it.produtoId != null ? 'produto' : 'avulso') as Tipo,
      label:
        it.produtoId != null
          ? produtos.find((p) => p.id === it.produtoId)?.nome ?? 'Produto'
          : it.descricao ?? 'Item avulso',
      qtd: it.quantidade,
      preco: it.precoUnitario,
      subtotal: it.subtotal,
      custo: it.custo,
      onRemove: () => rmProd.mutate(it.id, removido),
    })),
  ]

  return (
    <>
      <div className="form">
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            <StatusAtendimentoPill status={at.status} />
          </dd>
          <dt>Agendado para</dt>
          <dd>{at.dataAgendada ? `${dataCurta(at.dataAgendada)} · ${hora(at.dataAgendada)}` : 'sem agendamento'}</dd>
          <dt>Responsável</dt>
          <dd>{responsavelAtual}</dd>
          <dt>Total</dt>
          <dd style={{ fontWeight: 600 }}>{brl(at.valorTotal, true)}</dd>
          <dt>Custo</dt>
          <dd>{at.custoTotal > 0 ? brl(at.custoTotal, true) : <span title="Custo ainda não preenchido">—</span>}</dd>
          <dt>Margem</dt>
          <dd style={{ fontWeight: 600 }}>
            {at.custoTotal > 0 ? brl(at.margem, true) : <span className="hint">preencha o custo</span>}
          </dd>
        </dl>

        <span className="section-label">Itens</span>
        {itensLoading && <p className="hint" style={{ margin: 0 }}>Carregando itens…</p>}
        {!itensLoading && itens.length === 0 && <p className="hint" style={{ margin: 0 }}>Nenhum item ainda.</p>}
        {itens.length > 0 && (
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
                {itens.map((it) => (
                  <tr key={it.key}>
                    <td className="wrap">
                      <div className="cell">
                        <span className="cell-ic">
                          <Icon name={TIPO[it.tipo].icon} />
                        </span>
                        <span>
                          <span className="strong">{it.label}</span>
                          <span className="sub">
                            {TIPO[it.tipo].label} · {brl(it.preco, true)} un.
                            {it.custo != null && it.custo > 0 && ` · custo ${brl(it.custo, true)}`}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="n">{it.qtd}</td>
                    <td className="n strong">{brl(it.subtotal, true)}</td>
                    <td className="n">
                      <IconButton aria-label={`Remover ${it.label}`} style={{ width: 28, height: 28 }} onClick={it.onRemove}>
                        <Icon name="x" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <span className="section-label">Adicionar item</span>
        <SelectField
          label="Tipo"
          value={tipo}
          onChange={changeTipo}
          options={[
            { value: 'produto', label: 'Produto' + (controlaEstoque ? ' (baixa estoque)' : '') },
            ...(permiteServico ? [{ value: 'servico' as const, label: 'Serviço' }] : []),
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
              ...produtos.map((p) => ({
                value: String(p.id),
                label: p.nome + (controlaEstoque ? ` (${p.quantidadeEstoque} em estoque)` : ''),
              })),
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
              <Button size="sm" icon="plus" onClick={addSugeridos} disabled={addProd.isPending}>
                Adicionar sugeridos
              </Button>
            </div>
          </div>
        )}
        {tipo === 'avulso' && (
          <TextField label="Descrição" value={descricao} onChange={setDescricao} placeholder="Descrição do item" maxLength={200} />
        )}
        <div className="form-row">
          <NumberField label="Qtd." step={1} value={qtd} onChange={setQtd} />
          <NumberField label="Preço unit." prefix="R$" step={0.01} value={preco} onChange={setPreco} />
        </div>
        {tipo !== 'servico' && (
          <NumberField label="Custo da linha (opcional)" prefix="R$" step={0.01} value={custo} onChange={setCusto} />
        )}
        {draftError && (
          <span className="field-err" role="alert">
            {draftError}
          </span>
        )}
        <div>
          <Button icon="plus" onClick={addItem} disabled={addProd.isPending || addServ.isPending}>
            Adicionar item
          </Button>
        </div>

        {/* Salvar materiais como sugeridos de um serviço (kit-04) */}
        {materiaisDoAtendimento.length > 0 && servicosDoAtendimento.length > 0 && (
          <>
            <span className="section-label">Salvar materiais como sugeridos</span>
            <p className="hint" style={{ margin: 0 }}>
              Guarda os {materiaisDoAtendimento.length} material(is) deste atendimento como kit de um serviço
              (substitui o kit atual dele).
            </p>
            <SelectField
              label="Serviço"
              value={String(alvo)}
              onChange={(v) => setAlvoServicoId(Number(v))}
              options={servicosDoAtendimento.map((sid) => ({
                value: String(sid),
                label: servicos.find((s) => s.id === sid)?.descricao ?? `Serviço #${sid}`,
              }))}
            />
            <div>
              <Button onClick={salvarComoSugeridos} disabled={salvarSugeridos.isPending}>
                {salvarSugeridos.isPending ? 'Salvando…' : 'Salvar kit'}
              </Button>
            </div>
          </>
        )}

        <span className="section-label">Responsável, status e agenda</span>
        <SelectField
          label="Responsável"
          value={responsavel}
          onChange={setResponsavel}
          options={opcoesResponsavel.map((u) => ({
            value: String(u.id),
            label: u.nome + (u.perfil === 'Dono' ? ' (dono)' : '') + (u.ativo ? '' : ' (desativado)'),
          }))}
        />
        <div className="form-row">
          <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPCOES} />
          <TextField label="Agendado para" type="datetime-local" value={agenda} onChange={setAgenda} />
        </div>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onDelete} disabled={busy.delete} style={{ marginRight: 'auto', color: 'var(--neg-ink)' }}>
          {busy.delete ? 'Excluindo…' : 'Excluir atendimento'}
        </Button>
        <Button
          variant="primary"
          onClick={() => onUpdate(status, agenda ? new Date(agenda).toISOString() : null, Number(responsavel))}
          disabled={busy.update}
        >
          {busy.update ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </>
  )
}

interface ItemLinha {
  key: string
  tipo: Tipo
  label: string
  qtd: number
  preco: number
  subtotal: number
  custo: number | null
  onRemove: () => void
}
