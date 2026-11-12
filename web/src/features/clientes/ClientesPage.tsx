import { useState } from 'react'
import { clientesResource, useClientesPaginados } from './resource'
import { ClienteForm } from './ClienteForm'
import {
  Button,
  ButtonLink,
  CarregarMais,
  ConfirmDialog,
  Drawer,
  Empty,
  PageHead,
  SearchBox,
  brl,
  useToast,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useAtendimentosPaginados } from '../atendimentos/queries'
import { ApiError } from '../../lib/api'
import { dataCurta, iniciais } from '../../lib/format'
import { onlyDigits } from '../../lib/masks'
import { useDebounced } from '../../lib/paginacao'
import type { Atendimento, Cliente, ClienteInput } from '../../types/api'
import './clientes.css'

/** "R. das Acácias, 120 — Centro" a partir dos campos do cadastro. */
function enderecoLinha(c: Cliente): string | null {
  const rua = [c.logradouro, c.numero].filter(Boolean).join(', ')
  return [rua, c.bairro].filter(Boolean).join(' — ') || null
}

/** CPF com o miolo escondido: "111.•••.•••-44". */
function mascaraCpf(cpf: string | null | undefined): string | null {
  const d = onlyDigits(cpf ?? '')
  return d.length === 11 ? `${d.slice(0, 3)}.•••.•••-${d.slice(-2)}` : null
}

const dataDo = (a: Atendimento) => a.dataAgendada ?? a.dataRegistro

export function ClientesPage() {
  const [q, setQ] = useState('')
  const termo = useDebounced(q.trim())
  // PAG-01: 50 por vez, com a busca (sem acento, telefone por dígitos) no servidor.
  const list = useClientesPaginados(termo)
  const create = clientesResource.useCreate()
  const update = clientesResource.useUpdate()
  const remove = clientesResource.useRemove()
  const toast = useToast()

  const [selId, setSelId] = useState<number | null>(null)
  // O cliente recém-salvo pode cair fora das páginas carregadas: fica à mão para o painel.
  const [salvo, setSalvo] = useState<Cliente | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Cliente | null>(null)

  const visiveis = list.itens
  const sel =
    visiveis.find((c) => c.id === selId) ?? (salvo && salvo.id === selId ? salvo : null) ?? visiveis[0] ?? null

  // Histórico do cliente escolhido, do mais recente para o mais antigo (já ordenado no servidor).
  const historico = useAtendimentosPaginados({ clienteId: sel?.id }, sel !== null)

  function openCreate() {
    setEditing(null)
    setServerError(null)
    setDrawerOpen(true)
  }
  function openEdit(c: Cliente) {
    setEditing(c)
    setServerError(null)
    setDrawerOpen(true)
  }

  function handleSubmit(input: ClienteInput) {
    setServerError(null)
    const onSuccess = (salvo: Cliente) => {
      setDrawerOpen(false)
      if (salvo) {
        setSelId(salvo.id)
        setSalvo(salvo)
      }
      toast.success(editing ? 'Cliente atualizado.' : 'Cliente criado.')
    }
    const onError = (e: unknown) => setServerError(e instanceof ApiError ? e.message : 'Erro ao salvar.')

    if (editing) update.mutate({ id: editing.id, body: input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  function handleDelete() {
    if (!toDelete) return
    remove.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Cliente removido.')
        setToDelete(null)
      },
      onError: () => {
        toast.error('Não foi possível remover.')
        setToDelete(null)
      },
    })
  }

  const novoCliente = (
    <Button size="sm" variant="primary" icon="plus" style={{ marginTop: 6 }} onClick={openCreate}>
      Novo cliente
    </Button>
  )

  const h = sel ? historico.itens : []
  const endSel = sel ? enderecoLinha(sel) : null
  const cpfSel = sel ? mascaraCpf(sel.cpf) : null

  return (
    <>
      <PageHead
        title="Clientes"
        sub="Quem você atende, onde e como falar com cada um."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Novo cliente
          </Button>
        }
      />

      <div className="grid g-main-side">
        <section className="card">
          <div className="toolbar">
            <SearchBox
              value={q}
              onChange={setQ}
              placeholder="Buscar por nome, telefone ou bairro"
              label="Buscar cliente"
            />
            {!list.isLoading && (
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {list.total} {list.total === 1 ? 'cliente' : 'clientes'}
              </span>
            )}
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Endereço</th>
                  <th className="n">Atend.</th>
                  <th>Último</th>
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
                {visiveis.map((c) => {
                  const escolher = () => setSelId(c.id)
                  return (
                    <tr
                      key={c.id}
                      className={`row-click${c.id === sel?.id ? ' is-selected' : ''}`}
                      tabIndex={0}
                      onClick={escolher}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') escolher()
                      }}
                    >
                      <td>
                        <div className="cell">
                          <span className="avatar sm">{iniciais(c.nome)}</span>
                          <span className="strong">{c.nome}</span>
                        </div>
                      </td>
                      <td className={c.telefone ? undefined : 'muted'}>{c.telefone || '—'}</td>
                      <td className="muted">{enderecoLinha(c) ?? c.cidade ?? '—'}</td>
                      <td className="n">{c.totalAtendimentos ?? 0}</td>
                      <td>{c.ultimoAtendimento ? dataCurta(c.ultimoAtendimento) : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <CarregarMais
            carregados={visiveis.length}
            total={list.total}
            temMais={list.hasNextPage}
            carregando={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
            rotulo="clientes"
          />
          {list.isError && (
            <Empty icon="alert" title="Não foi possível carregar os clientes">
              {list.error instanceof ApiError ? list.error.message : 'Tente de novo em instantes.'}
            </Empty>
          )}
          {!list.isLoading && !list.isError && visiveis.length === 0 && (
            <div className="empty">
              <span className="ic">
                <Icon name="users" />
              </span>
              <b>{termo ? 'Nenhum cliente com esse nome' : 'Nenhum cliente ainda'}</b>
              <p>Cadastre agora para usar no próximo orçamento.</p>
              {novoCliente}
            </div>
          )}
        </section>

        <section className="card" aria-live="polite">
          {sel ? (
            <>
              <div className="profile">
                <span className="avatar">{iniciais(sel.nome)}</span>
                <h2>{sel.nome}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <ButtonLink to="/orcamentos" size="sm" variant="primary" icon="file" viewTransition>
                    Novo orçamento
                  </ButtonLink>
                  <Button size="sm" icon="pencil" onClick={() => openEdit(sel)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(sel)}>
                    Excluir
                  </Button>
                </div>
              </div>
              <dl className="facts">
                <div>
                  <dt>
                    <Icon name="phone" className="sm" />
                  </dt>
                  <dd>{sel.telefone || <span>Sem telefone cadastrado</span>}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="pin" className="sm" />
                  </dt>
                  <dd>
                    {endSel || <span>Sem endereço</span>}
                    {(sel.cidade || sel.cep) && (
                      <span>{[sel.cidade, sel.cep && `CEP ${sel.cep}`].filter(Boolean).join(' · ')}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Icon name="user" className="sm" />
                  </dt>
                  <dd>{cpfSel || <span>CPF não informado</span>}</dd>
                </div>
              </dl>
              <div className="hist">
                <h3>Atendimentos</h3>
                {historico.isLoading ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Carregando…
                  </p>
                ) : h.length ? (
                  h.map((a) => {
                    const resumo = a.resumo
                    return (
                      <div key={a.id} className="hist-row">
                        <span className="d">{dataCurta(dataDo(a))}</span>
                        {resumo ? (
                          <span>{resumo}</span>
                        ) : (
                          <span title="Atendimento sem itens">—</span>
                        )}
                        <span className="v">{brl(a.valorTotal)}</span>
                      </div>
                    )
                  })
                ) : (
                  <p className="hint" style={{ margin: 0 }}>
                    Nenhum atendimento ainda.
                  </p>
                )}
                {historico.hasNextPage && (
                  <Button size="sm" variant="ghost" onClick={() => historico.fetchNextPage()} disabled={historico.isFetchingNextPage}>
                    {historico.isFetchingNextPage ? 'Carregando…' : `Ver mais (${h.length} de ${historico.total})`}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Empty icon="users" title={list.isLoading ? 'Carregando…' : 'Nenhum cliente selecionado'}>
              {list.isLoading ? null : 'Cadastre um cliente para ver os dados e o histórico aqui.'}
            </Empty>
          )}
        </section>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        sub={editing ? editing.nome : 'Nome e CPF são obrigatórios.'}
      >
        <ClienteForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          serverError={serverError}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir cliente"
        message={`Remover "${toDelete?.nome}"? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
