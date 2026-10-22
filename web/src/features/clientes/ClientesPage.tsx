import { useMemo, useState } from 'react'
import { clientesResource } from './resource'
import { ClienteForm } from './ClienteForm'
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  Drawer,
  Empty,
  PageHead,
  SearchBox,
  brl,
  useToast,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useAtendimentos } from '../atendimentos/queries'
import { useAgenda } from '../../lib/queries'
import { ApiError } from '../../lib/api'
import { dataCurta, iniciais } from '../../lib/format'
import { onlyDigits } from '../../lib/masks'
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

/** Minúsculas e sem acento, para a busca achar "joao" em "João". */
const normaliza = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const dataDo = (a: Atendimento) => a.dataAgendada ?? a.dataRegistro

export function ClientesPage() {
  const list = clientesResource.useList()
  const create = clientesResource.useCreate()
  const update = clientesResource.useUpdate()
  const remove = clientesResource.useRemove()
  const atend = useAtendimentos()
  // O resumo do serviço só vem na agenda; o histórico usa a do ano corrente.
  const agenda = useAgenda('ano')
  const toast = useToast()

  const [q, setQ] = useState('')
  const [selId, setSelId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Cliente | null>(null)

  const clientes = list.data ?? []
  const termo = normaliza(q.trim())
  const digitos = onlyDigits(q)
  const visiveis = clientes.filter((c) => {
    if (!termo) return true
    const texto = normaliza([c.nome, c.telefone, enderecoLinha(c), c.cidade].filter(Boolean).join(' '))
    return texto.includes(termo) || (digitos.length >= 3 && onlyDigits(c.telefone ?? '').includes(digitos))
  })
  const sel = clientes.find((c) => c.id === selId) ?? clientes[0] ?? null

  // atendimentos por cliente, do mais recente para o mais antigo
  const historico = useMemo(() => {
    const m = new Map<number, Atendimento[]>()
    for (const a of atend.data ?? []) {
      const lista = m.get(a.clienteId)
      if (lista) lista.push(a)
      else m.set(a.clienteId, [a])
    }
    for (const lista of m.values()) lista.sort((a, b) => dataDo(b).localeCompare(dataDo(a)))
    return m
  }, [atend.data])
  const resumoDe = (id: number) => agenda.data?.find((i) => i.id === id)?.resumo ?? null

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
      if (salvo) setSelId(salvo.id)
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

  const h = sel ? historico.get(sel.id) ?? [] : []
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
                {visiveis.length} {visiveis.length === 1 ? 'cliente' : 'clientes'}
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
                  const hc = historico.get(c.id) ?? []
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
                      <td className="n">{atend.isLoading ? '—' : hc.length}</td>
                      <td>{hc.length ? dataCurta(dataDo(hc[0]!)) : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
                {atend.isLoading ? (
                  <p className="hint" style={{ margin: 0 }}>
                    Carregando…
                  </p>
                ) : h.length ? (
                  h.map((a) => {
                    const resumo = resumoDe(a.id)
                    return (
                      <div key={a.id} className="hist-row">
                        <span className="d">{dataCurta(dataDo(a))}</span>
                        {resumo ? (
                          <span>{resumo}</span>
                        ) : (
                          <span title="O resumo do serviço aparece para os atendimentos agendados neste ano">—</span>
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
