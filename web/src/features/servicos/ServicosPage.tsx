import { useState, type KeyboardEvent } from 'react'
import { aRevisar, servicosResource, useMarcarRevisado } from './resource'
import { useServicoSugeridos } from './sugeridosQueries'
import { ServicoForm } from './ServicoForm'
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Empty,
  PageHead,
  Seg,
  brl,
  useToast,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { useDashboard } from '../../lib/queries'
import type { Servico, ServicoInput, ServicoReceitaItem } from '../../types/api'
import './servicos.css'

const COBRANCA: Record<Servico['tipoCobranca'], string> = { PorHora: 'Por hora', Empreitada: 'Empreitada' }

type Filtro = 'todos' | 'revisar'

function valorDe(s: Servico): number | null {
  return s.tipoCobranca === 'PorHora' ? s.valorHora : s.valorEmpreitada
}

/** "R$ 120,00/h" na tabela. */
function Valor({ s }: { s: Servico }) {
  const v = valorDe(s)
  if (v == null) return <span className="muted">—</span>
  return (
    <>
      {brl(v, true)}
      {s.tipoCobranca === 'PorHora' && <span className="muted">/h</span>}
    </>
  )
}

/** Painel da direita: números do mês e kit de materiais do serviço selecionado. */
function ServicoDetalhe({
  s,
  st,
  carregandoMes,
  onEdit,
  onRevisar,
  revisando,
}: {
  s: Servico
  st: ServicoReceitaItem | undefined
  carregandoMes: boolean
  onEdit: () => void
  onRevisar: () => void
  revisando: boolean
}) {
  const kit = useServicoSugeridos(s.id)
  const itens = kit.data ?? []
  const v = valorDe(s)

  return (
    <section className="card" aria-live="polite">
      <div className="card-head">
        <div>
          <h2 className="card-title">{s.descricao}</h2>
          <p className="card-sub">
            {COBRANCA[s.tipoCobranca]} · {brl(v, true)}
            {s.tipoCobranca === 'PorHora' ? ' por hora' : ' por serviço'}
          </p>
        </div>
        <div className="end">
          {!s.revisado && (
            <Button size="sm" icon="check" onClick={onRevisar} disabled={revisando}>
              Revisado
            </Button>
          )}
          <Button size="sm" icon="pencil" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
      {!s.revisado && (
        <div style={{ padding: '12px 16px 0' }}>
          <div className="alert">
            <Icon name="alert" />
            <div>
              <b>Criado no app por {s.criadoPorNome ?? 'um agente'}</b>
              <span>Confira preço e descrição e marque como revisado.</span>
            </div>
          </div>
        </div>
      )}
      <dl className="svc-stats" style={{ marginBottom: 0 }}>
        <div>
          <dt>Atendimentos</dt>
          <dd>{carregandoMes ? '…' : (st?.quantidade ?? 0)}</dd>
        </div>
        <div>
          <dt>Receita</dt>
          <dd>{carregandoMes ? '…' : brl(st?.receita ?? 0)}</dd>
        </div>
        <div>
          <dt>Margem</dt>
          <dd
            className="muted"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}
            title="O cadastro de serviço não tem custo, então não há margem a calcular"
          >
            sem custo
          </dd>
        </div>
      </dl>
      <div className="card-head">
        <div>
          <h3 className="card-title" style={{ fontSize: 13.5 }}>
            Kit de materiais sugeridos
          </h3>
          <p className="card-sub">Entram sozinhos no orçamento quando você escolhe este serviço</p>
        </div>
        {itens.length > 0 && (
          <div className="end">
            <Button size="sm" icon="pencil" onClick={onEdit}>
              Editar kit
            </Button>
          </div>
        )}
      </div>
      {kit.isLoading ? (
        <p className="hint" style={{ margin: 0, padding: '16px' }}>
          Carregando…
        </p>
      ) : itens.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Material</th>
                <th className="n">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.produtoId}>
                  <td>
                    <div className="cell">
                      <span className="cell-ic">
                        <Icon name="box" />
                      </span>
                      <span className="strong">{i.produtoNome}</span>
                    </div>
                  </td>
                  <td className="n">{i.quantidadePadrao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty" style={{ padding: '24px 16px 28px' }}>
          <span className="ic">
            <Icon name="box" />
          </span>
          <b>Nenhum material no kit</b>
          <p>Ex.: suporte, gás e cano de dreno para uma instalação. Você monta uma vez e reaproveita sempre.</p>
          <Button size="sm" variant="primary" icon="plus" style={{ marginTop: 6 }} onClick={onEdit}>
            Montar kit
          </Button>
        </div>
      )}
    </section>
  )
}

export function ServicosPage() {
  const list = servicosResource.useList()
  const create = servicosResource.useCreate()
  const update = servicosResource.useUpdate()
  const remove = servicosResource.useRemove()
  const revisar = useMarcarRevisado()
  const toast = useToast()
  // atendimentos e receita de cada serviço no mês corrente
  const dash = useDashboard('mes')

  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selId, setSelId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Servico | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Servico | null>(null)

  const pendentes = aRevisar(list.data)
  const filtrando = filtro === 'revisar' && pendentes.length > 0
  const rows = (filtrando ? pendentes : list.data) ?? []
  const sel = rows.find((s) => s.id === selId) ?? rows[0] ?? null
  const stats = (id: number) => dash.data?.servicos.receitaPorServico.find((r) => r.servicoId === id)

  function openCreate() {
    setEditing(null)
    setServerError(null)
    setDrawerOpen(true)
  }
  function openEdit(s: Servico) {
    setEditing(s)
    setServerError(null)
    setDrawerOpen(true)
  }
  function onRowKey(e: KeyboardEvent, s: Servico) {
    if (e.key === 'Enter') setSelId(s.id)
  }

  function handleSubmit(input: ServicoInput) {
    setServerError(null)
    const onSuccess = (salvo: Servico) => {
      setDrawerOpen(false)
      setSelId(salvo.id)
      toast.success(editing ? 'Serviço atualizado.' : 'Serviço criado.')
    }
    const onError = (e: unknown) =>
      setServerError(e instanceof ApiError ? e.message : 'Erro ao salvar.')

    if (editing) update.mutate({ id: editing.id, body: input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  function handleRevisar(s: Servico) {
    revisar.mutate(s.id, {
      onSuccess: () => toast.success(`"${s.descricao}" revisado.`),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível revisar.'),
    })
  }

  function handleDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Serviço removido.')
        setToDelete(null)
      },
      onError: () => {
        toast.error('Não foi possível remover.')
        setToDelete(null)
      },
    })
  }

  return (
    <>
      <PageHead
        title="Serviços"
        sub="O catálogo do que você cobra: por hora ou por empreitada, com o kit de materiais de cada um."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Novo serviço
          </Button>
        }
      />

      <div className="grid g-main-side">
        <section className="card">
          {pendentes.length > 0 && (
            <div className="toolbar">
              <Seg<Filtro>
                label="Filtro"
                value={filtro}
                onChange={setFiltro}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'revisar', label: `A revisar (${pendentes.length})` },
                ]}
              />
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {pendentes.length === 1
                  ? '1 serviço criado no app espera revisão'
                  : `${pendentes.length} serviços criados no app esperam revisão`}
              </span>
            </div>
          )}
          <div className="table-wrap" style={{ marginTop: 0 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Cobrança</th>
                  <th className="n">Valor</th>
                  <th className="n">Atend. no mês</th>
                  <th className="n">Receita no mês</th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
                      Carregando…
                    </td>
                  </tr>
                )}
                {list.isError && (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
                      Não foi possível carregar os serviços
                      {list.error instanceof ApiError ? `: ${list.error.message}` : '.'}
                    </td>
                  </tr>
                )}
                {rows.map((s) => {
                  const st = stats(s.id)
                  return (
                    <tr
                      key={s.id}
                      className={`row-click${s.id === sel?.id ? ' is-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => setSelId(s.id)}
                      onKeyDown={(e) => onRowKey(e, s)}
                    >
                      <td>
                        <div className="cell">
                          <span className="cell-ic">
                            <Icon name="hammer" />
                          </span>
                          <span className="strong">{s.descricao}</span>
                          {!s.revisado && (
                            <Badge tone="warn" dot>
                              A revisar
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge tone={s.tipoCobranca === 'Empreitada' ? 'brand' : 'neutral'}>
                          {COBRANCA[s.tipoCobranca]}
                        </Badge>
                      </td>
                      <td className="n">
                        <Valor s={s} />
                      </td>
                      <td className="n">{st ? st.quantidade : <span className="muted">{dash.data ? 0 : '—'}</span>}</td>
                      <td className="n strong">{st ? brl(st.receita) : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {list.isSuccess && rows.length === 0 && (
            <div className="empty">
              <span className="ic">
                <Icon name="hammer" />
              </span>
              <b>Nenhum serviço cadastrado</b>
              <p>Cadastre o que você cobra para montar orçamentos mais rápido.</p>
              <Button size="sm" variant="primary" icon="plus" style={{ marginTop: 6 }} onClick={openCreate}>
                Novo serviço
              </Button>
            </div>
          )}
        </section>

        {sel ? (
          <ServicoDetalhe
            key={sel.id}
            s={sel}
            st={stats(sel.id)}
            carregandoMes={dash.isLoading}
            onEdit={() => openEdit(sel)}
            onRevisar={() => handleRevisar(sel)}
            revisando={revisar.isPending}
          />
        ) : (
          <section className="card" aria-live="polite">
            <Empty icon="hammer" title="Nenhum serviço selecionado">
              {list.isLoading ? 'Carregando…' : 'Escolha um serviço na lista para ver os números e o kit dele.'}
            </Empty>
          </section>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar serviço' : 'Novo serviço'}
        sub={editing?.descricao}
      >
        <ServicoForm
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
        />
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir serviço"
        message={`Remover "${toDelete?.descricao}"? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
