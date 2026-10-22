import { useState, type KeyboardEvent } from 'react'
import { produtosResource } from './resource'
import { ProdutoForm } from './ProdutoForm'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  PageHead,
  SearchBox,
  Seg,
  Switch,
  brl,
  useToast,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { useDashboard } from '../../lib/queries'
import { MES_LONGO } from '../../lib/format'
import { useConfiguracao, useUpdateConfiguracao } from '../parametrizacao/queries'
import type { Produto, ProdutoInput } from '../../types/api'
import './produtos.css'

/** O ranking de produtos do painel traz só os 5 que mais faturaram (MetricasRepository). */
const TOP_PRODUTOS = 5
const DIA_MS = 86_400_000

type Filtro = 'todos' | 'atencao'

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function ProdutosPage() {
  const list = produtosResource.useList()
  const create = produtosResource.useCreate()
  const update = produtosResource.useUpdate()
  const remove = produtosResource.useRemove()
  const toast = useToast()
  const config = useConfiguracao()
  const updateConfig = useUpdateConfiguracao()
  const controlaEstoque = config.data?.controlaEstoque ?? true
  // vendidos, receita e alertas de estoque do mês corrente
  const dash = useDashboard('mes')

  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Produto | null>(null)

  const estoque = controlaEstoque ? dash.data?.estoque : undefined
  const ruptura = estoque?.rupturaIminente ?? []
  const parados = estoque?.produtosParados ?? []
  const top = dash.data?.vendas.topProdutos ?? []
  // com menos de 5 no ranking, quem ficou de fora não vendeu nada no mês
  const rankingCompleto = top.length < TOP_PRODUTOS

  const todos = list.data ?? []
  const maxEst = Math.max(1, ...todos.map((p) => p.quantidadeEstoque))
  const termo = q.trim().toLowerCase()
  const rows = todos
    .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
    .filter(
      (p) =>
        !controlaEstoque ||
        filtro === 'todos' ||
        ruptura.some((r) => r.produtoId === p.id) ||
        parados.some((r) => r.produtoId === p.id),
    )

  function openCreate() {
    setEditing(null)
    setServerError(null)
    setDrawerOpen(true)
  }
  function openEdit(p: Produto) {
    setEditing(p)
    setServerError(null)
    setDrawerOpen(true)
  }
  function onRowKey(e: KeyboardEvent, p: Produto) {
    if (e.key === 'Enter') openEdit(p)
  }

  function handleSubmit(input: ProdutoInput) {
    setServerError(null)
    const onSuccess = () => {
      setDrawerOpen(false)
      toast.success(editing ? 'Produto atualizado.' : 'Produto criado.')
    }
    const onError = (e: unknown) =>
      setServerError(e instanceof ApiError ? e.message : 'Erro ao salvar.')

    if (editing) update.mutate({ id: editing.id, body: input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  function handleDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Produto removido.')
        setToDelete(null)
      },
      onError: () => {
        toast.error('Não foi possível remover.')
        setToDelete(null)
      },
    })
  }

  function toggleEstoque(ligado: boolean) {
    if (!config.data) return
    updateConfig.mutate(
      // o PUT exige o tipo de operação; os demais campos nulos ficam como estão
      { tipoOperacao: config.data.tipoOperacao, controlaEstoque: ligado },
      {
        onSuccess: () => toast.success(ligado ? 'Controle de estoque ligado.' : 'Controle de estoque desligado.'),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível alterar o estoque.'),
      },
    )
  }

  function vendidos(p: Produto) {
    const t = top.find((x) => x.produtoId === p.id)
    if (t) return { quantidade: <>{t.quantidade}</>, receita: <>{brl(t.receita)}</> }
    if (!dash.data) return { quantidade: <span className="muted">—</span>, receita: <span className="muted">—</span> }
    if (rankingCompleto)
      return {
        quantidade: <span className="muted">0</span>,
        receita: <span className="muted">—</span>,
      }
    const fora = `Fora dos ${TOP_PRODUTOS} produtos que mais faturaram no mês`
    return {
      quantidade: (
        <span className="muted" title={fora}>
          —
        </span>
      ),
      receita: (
        <span className="muted" title={fora}>
          —
        </span>
      ),
    }
  }

  function flag(p: Produto) {
    const rup = ruptura.find((r) => r.produtoId === p.id)
    if (rup)
      return (
        <Badge tone="neg" icon="alert">
          ~{Math.round(rup.diasAteRuptura)} dias
        </Badge>
      )
    if (parados.some((r) => r.produtoId === p.id))
      return (
        <Badge tone="warn" icon="archive">
          Parado
        </Badge>
      )
    return null
  }

  const colunas = controlaEstoque ? 7 : 6
  const n = todos.length

  return (
    <>
      <PageHead
        title="Produtos"
        badge={list.data && <Badge>{n === 1 ? '1 item' : `${n} itens`}</Badge>}
        sub={
          controlaEstoque
            ? 'Materiais que você usa e vende nos atendimentos. O estoque baixa quando um orçamento aprovado vira atendimento.'
            : 'Materiais que você usa e vende nos atendimentos.'
        }
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Novo produto
          </Button>
        }
      />

      {(ruptura.length > 0 || parados.length > 0) && (
        <div className="grid g-2">
          {ruptura.map((r) => (
            <Alert
              key={`r${r.produtoId}`}
              tone="neg"
              icon="alert"
              title={`${r.nome} acaba em ~${Math.round(r.diasAteRuptura)} dias`}
              subtitle={`${r.quantidadeEstoque} em estoque · consumo médio de ${num(r.consumoDiarioMedio)} por dia`}
            />
          ))}
          {parados.map((p) => (
            <Alert
              key={`p${p.produtoId}`}
              tone="warn"
              icon="archive"
              title={
                p.ultimaVenda
                  ? `${p.nome} sem saída há ${Math.floor((Date.now() - new Date(p.ultimaVenda).getTime()) / DIA_MS)} dias`
                  : `${p.nome} sem saída registrada`
              }
              subtitle={`${p.quantidadeEstoque} ${p.quantidadeEstoque === 1 ? 'unidade parada' : 'unidades paradas'}`}
            />
          ))}
        </div>
      )}

      <section className="card mt">
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar produto" label="Buscar produto" />
          <span className="hint">Vendidos e receita: {MES_LONGO[new Date().getMonth()]}</span>
          {controlaEstoque && (
            <Seg<Filtro>
              label="Filtro"
              className="ml-auto"
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'atencao', label: 'Atenção' },
              ]}
            />
          )}
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Produto</th>
                <th className="n">Preço</th>
                <th className="n">Custo</th>
                {controlaEstoque && <th>Estoque</th>}
                <th className="n" title="No mês">
                  Vendidos
                </th>
                <th className="n" title="No mês">
                  Receita
                </th>
                <th>
                  <span className="sr-only">Situação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={colunas} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
                    Carregando…
                  </td>
                </tr>
              )}
              {list.isError && (
                <tr>
                  <td colSpan={colunas} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
                    Não foi possível carregar os produtos
                    {list.error instanceof ApiError ? `: ${list.error.message}` : '.'}
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const v = vendidos(p)
                const hi = ruptura.some((r) => r.produtoId === p.id)
                return (
                  <tr
                    key={p.id}
                    className="row-click"
                    tabIndex={0}
                    aria-label={`Editar ${p.nome}`}
                    onClick={() => openEdit(p)}
                    onKeyDown={(e) => onRowKey(e, p)}
                  >
                    <td>
                      <div className="cell">
                        <span className="cell-ic">
                          <Icon name="box" />
                        </span>
                        <span className="strong">{p.nome}</span>
                      </div>
                    </td>
                    <td className="n">{brl(p.preco, true)}</td>
                    <td className="n muted" title="O cadastro de produto ainda não tem custo">
                      —
                    </td>
                    {controlaEstoque && (
                      <td>
                        <div className="stock">
                          <div className={`track${hi ? ' hi' : ''}`}>
                            <i style={{ width: `${(Math.max(0, p.quantidadeEstoque) / maxEst) * 100}%` }} />
                          </div>
                          <b>{p.quantidadeEstoque}</b>
                        </div>
                      </td>
                    )}
                    <td className="n">{v.quantidade}</td>
                    <td className="n strong">{v.receita}</td>
                    <td>{flag(p)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {list.isSuccess && n === 0 && (
          <div className="empty">
            <span className="ic">
              <Icon name="box" />
            </span>
            <b>Nenhum produto cadastrado</b>
            <p>Cadastre os materiais que você usa para lançar nos orçamentos.</p>
            <Button size="sm" variant="primary" icon="plus" style={{ marginTop: 6 }} onClick={openCreate}>
              Novo produto
            </Button>
          </div>
        )}
        {list.isSuccess && n > 0 && rows.length === 0 && (
          <div className="empty">
            <span className="ic">
              <Icon name="box" />
            </span>
            <b>Nenhum produto encontrado</b>
            <p>{filtro === 'atencao' && !termo ? 'Nenhum produto pede atenção agora.' : 'Tente outro nome.'}</p>
          </div>
        )}
        <div className="note">
          <Icon name="box" />
          {controlaEstoque ? (
            <span>
              <b style={{ color: 'var(--ink)' }}>Controle de estoque ativo.</b> Desligado, os produtos viram só uma
              lista de materiais com preço e custo.
            </span>
          ) : (
            <span>
              <b style={{ color: 'var(--ink)' }}>Controle de estoque desligado.</b> Ligado, o estoque baixa sozinho
              quando um orçamento aprovado vira atendimento.
            </span>
          )}
          <Switch
            checked={controlaEstoque}
            onChange={toggleEstoque}
            label="Controle de estoque"
            disabled={!config.data || updateConfig.isPending}
          />
        </div>
      </section>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar produto' : 'Novo produto'}
        sub={editing?.nome}
      >
        <ProdutoForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          serverError={serverError}
          onCancel={() => setDrawerOpen(false)}
          onDelete={
            editing
              ? () => {
                  setDrawerOpen(false)
                  setToDelete(editing)
                }
              : undefined
          }
          controlaEstoque={controlaEstoque}
        />
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir produto"
        message={`Remover "${toDelete?.nome}"? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
