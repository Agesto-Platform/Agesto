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
import { Button, Money, NumberField, useToast } from '../../components/ui'
import { IconPlus, IconTrash } from '../../components/icons'
import { ApiError } from '../../lib/api'
import { useConfiguracao } from '../parametrizacao/queries'
import { useServicoSugeridos, useUpdateServicoSugeridos } from '../servicos/sugeridosQueries'
import type {
  Atendimento,
  Produto,
  Servico,
  StatusAtendimento,
  Usuario,
} from '../../types/api'

const selectCls =
  'rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand'

type Tipo = 'produto' | 'servico' | 'avulso'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function AtendimentoDetail({
  atendimento,
  clienteNome,
  responsaveis,
  produtos,
  servicos,
  onUpdate,
  onDelete,
  busy,
}: {
  atendimento: Atendimento
  clienteNome: string
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
  const [responsavel, setResponsavel] = useState(at.usuarioId)
  // O responsável atual pode estar desativado: continua na lista para não sumir do select.
  const opcoesResponsavel = responsaveis.filter((u) => u.ativo || u.id === at.usuarioId)

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
      addServ.mutate(
        { atendimentoId: at.id, servicoId: Number(refId), precoUnitario: preco ?? null, quantidade: qtd },
        { onSuccess: () => { toast.success('Item adicionado.'); resetDraft() }, onError },
      )
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

  const itensLoading = prods.isLoading || servs.isLoading
  const vazio =
    !itensLoading && (prods.data?.length ?? 0) === 0 && (servs.data?.length ?? 0) === 0

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-semibold text-ink">{clienteNome}</div>
            <div className="text-[12.5px] text-ink-3">
              Atendimento #{at.id} ·{' '}
              {new Date(at.dataRegistro).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>
          <StatusAtendimentoPill status={at.status} />
        </div>

        {/* Resumo financeiro */}
        <div className="grid grid-cols-3 gap-2 rounded-sm border border-line-2 p-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-4">Valor</div>
            <Money value={at.valorTotal} cents className="text-[15px] text-ink" />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-4">Custo</div>
            <Money value={at.custoTotal} cents className="text-[15px] text-ink-2" />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-4">Margem</div>
            <Money value={at.margem} cents className="text-[15px] font-semibold text-brand-ink" />
          </div>
        </div>

        {/* Itens */}
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px] font-semibold text-ink-2">Itens</span>
          {itensLoading && <p className="text-[12.5px] text-ink-3">Carregando itens…</p>}
          {vazio && <p className="text-[12.5px] text-ink-3">Nenhum item ainda.</p>}

          {servs.data?.map((it) => (
            <ItemRow
              key={`s${it.id}`}
              label={servicos.find((s) => s.id === it.servicoId)?.descricao ?? 'Serviço'}
              tag="serviço"
              qtd={it.quantidade}
              preco={it.precoUnitario}
              subtotal={it.subtotal}
              onRemove={() =>
                rmServ.mutate(it.id, {
                  onSuccess: () => toast.success('Item removido.'),
                  onError: () => toast.error('Falha ao remover.'),
                })
              }
            />
          ))}
          {prods.data?.map((it) => (
            <ItemRow
              key={`p${it.id}`}
              label={
                it.produtoId != null
                  ? produtos.find((p) => p.id === it.produtoId)?.nome ?? 'Produto'
                  : it.descricao ?? 'Item avulso'
              }
              tag={it.produtoId != null ? 'produto' : 'avulso'}
              qtd={it.quantidade}
              preco={it.precoUnitario}
              subtotal={it.subtotal}
              custo={it.custo}
              onRemove={() =>
                rmProd.mutate(it.id, {
                  onSuccess: () => toast.success('Item removido.'),
                  onError: () => toast.error('Falha ao remover.'),
                })
              }
            />
          ))}
        </div>

        {/* Adicionar item */}
        <div className="flex flex-col gap-3 rounded-sm border border-dashed border-line bg-surface-2 p-3">
          <select value={tipo} onChange={(e) => changeTipo(e.target.value as Tipo)} className={selectCls}>
            <option value="produto">Produto{controlaEstoque ? ' (baixa estoque)' : ''}</option>
            {permiteServico && <option value="servico">Serviço</option>}
            <option value="avulso">Item avulso</option>
          </select>

          {tipo === 'produto' && (
            <select value={refId} onChange={(e) => pickProduto(e.target.value)} className={selectCls}>
              <option value="">Escolha o produto…</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {controlaEstoque ? ` (${p.quantidadeEstoque} em estoque)` : ''}
                </option>
              ))}
            </select>
          )}
          {tipo === 'servico' && (
            <select value={refId} onChange={(e) => pickServico(e.target.value)} className={selectCls}>
              <option value="">Escolha o serviço…</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.descricao}
                </option>
              ))}
            </select>
          )}

          {tipo === 'servico' && servicoSelId > 0 && (sugeridos.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2 rounded-sm border border-brand/30 bg-brand-soft px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-brand-ink">
                  Materiais sugeridos ({sugeridos.data!.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={addSugeridos}
                  disabled={addProd.isPending}
                  className="!py-1 !text-[12px]"
                >
                  <IconPlus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <span className="text-[11.5px] text-ink-3">
                {sugeridos.data!.map((s) => `${s.produtoNome} ×${s.quantidadePadrao}`).join(' · ')}
              </span>
            </div>
          )}
          {tipo === 'avulso' && (
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do item"
              maxLength={200}
              className={selectCls}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Qtd." step={1} value={qtd} onChange={setQtd} />
            <NumberField label="Preço unit." prefix="R$" step={0.01} value={preco} onChange={setPreco} />
          </div>
          {tipo !== 'servico' && (
            <NumberField label="Custo da linha (opcional)" prefix="R$" step={0.01} value={custo} onChange={setCusto} />
          )}

          {draftError && <span className="text-[12px] text-bad">{draftError}</span>}

          <Button
            type="button"
            variant="ghost"
            onClick={addItem}
            disabled={addProd.isPending || addServ.isPending}
            className="self-start"
          >
            <IconPlus className="h-4 w-4" /> Adicionar item
          </Button>
        </div>

        {/* Salvar materiais como sugeridos de um serviço (kit-04) */}
        {materiaisDoAtendimento.length > 0 && servicosDoAtendimento.length > 0 && (
          <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface-2 px-3 py-3">
            <span className="text-[12px] font-semibold text-ink-2">Salvar materiais como sugeridos</span>
            <p className="text-[11.5px] text-ink-4">
              Guarda os {materiaisDoAtendimento.length} material(is) deste atendimento como kit de um serviço
              (substitui o kit atual dele).
            </p>
            <div className="flex items-center gap-2">
              <select
                value={alvo}
                onChange={(e) => setAlvoServicoId(Number(e.target.value))}
                className={`${selectCls} flex-1`}
              >
                {servicosDoAtendimento.map((sid) => (
                  <option key={sid} value={sid}>
                    {servicos.find((s) => s.id === sid)?.descricao ?? `Serviço #${sid}`}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                onClick={salvarComoSugeridos}
                disabled={salvarSugeridos.isPending}
              >
                {salvarSugeridos.isPending ? 'Salvando…' : 'Salvar kit'}
              </Button>
            </div>
          </div>
        )}

        {/* Status / reagendamento */}
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <span className="text-[12.5px] font-semibold text-ink-2">Responsável, status e agenda</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(Number(e.target.value))}
            aria-label="Responsável"
            className={selectCls}
          >
            {opcoesResponsavel.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.perfil === 'Dono' ? ' (dono)' : ''}
                {u.ativo ? '' : ' (desativado)'}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusAtendimento)} className={selectCls}>
              <option value="Pendente">Pendente</option>
              <option value="Concluido">Concluído</option>
              <option value="Cancelado">Cancelado</option>
            </select>
            <input type="datetime-local" value={agenda} onChange={(e) => setAgenda(e.target.value)} className={selectCls} />
          </div>
          <Button
            type="button"
            onClick={() => onUpdate(status, agenda ? new Date(agenda).toISOString() : null, responsavel)}
            disabled={busy.update}
            className="self-start"
          >
            {busy.update ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      <div className="flex justify-between border-t border-line px-5 py-4">
        <button
          type="button"
          onClick={onDelete}
          disabled={busy.delete}
          className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-bad transition hover:bg-bad-soft disabled:opacity-60"
        >
          {busy.delete ? 'Excluindo…' : 'Excluir atendimento'}
        </button>
      </div>
    </div>
  )
}

function ItemRow({
  label,
  tag,
  qtd,
  preco,
  subtotal,
  custo,
  onRemove,
}: {
  label: string
  tag: string
  qtd: number
  preco: number
  subtotal: number
  custo?: number | null
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-line-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">
          {label}{' '}
          <span className="text-[10.5px] uppercase tracking-wide text-ink-4">{tag}</span>
        </div>
        <div className="text-[11.5px] text-ink-3">
          {qtd} × <Money value={preco} cents />
          {custo != null && custo > 0 && (
            <>
              {' · custo '}
              <Money value={custo} cents />
            </>
          )}
        </div>
      </div>
      <Money value={subtotal} cents className="text-[13px] font-semibold" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover item"
        className="grid h-7 w-7 flex-none place-items-center rounded-[8px] text-ink-4 transition hover:bg-surface-2 hover:text-bad"
      >
        <IconTrash className="h-[15px] w-[15px]" />
      </button>
    </div>
  )
}
