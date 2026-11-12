import { useState } from 'react'
import {
  useOrcamento,
  useOrcamentoResumo,
  useOrcamentosPaginados,
  useCreateOrcamento,
  useUpdateStatus,
  useDeleteOrcamento,
  useConverterOrcamento,
} from './queries'
import { OrcamentoForm } from './OrcamentoForm'
import { OrcamentoDetail, OrcamentoEditForm } from './OrcamentoDetail'
import { StatusOrcamentoPill } from './status'
import { numero } from './labels'
import {
  Button,
  Card,
  CarregarMais,
  ConfirmDialog,
  Drawer,
  Empty,
  PageHead,
  SearchBox,
  brl,
  useToast,
} from '../../components/ui'
import { ApiError } from '../../lib/api'
import { dataCurta } from '../../lib/format'
import { useDebounced } from '../../lib/paginacao'
import type { Orcamento, OrcamentoInput, StatusOrcamento } from '../../types/api'
import './orcamentos.css'

const ORDEM: StatusOrcamento[] = ['Rascunho', 'Enviado', 'Aprovado', 'Recusado']

export function OrcamentosPage() {
  const [busca, setBusca] = useState('')
  const buscaServidor = useDebounced(busca.trim())
  // PAG-01: 50 por vez, os mais recentes primeiro, com busca pelo cliente no servidor.
  const list = useOrcamentosPaginados({ busca: buscaServidor || undefined })
  const resumo = useOrcamentoResumo()
  const create = useCreateOrcamento()
  const updateStatus = useUpdateStatus()
  const remove = useDeleteOrcamento()
  const converter = useConverterOrcamento()
  const toast = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selId, setSelId] = useState<number | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const clienteNome = (o: Orcamento) => o.clienteNome ?? `Cliente #${o.clienteId}`

  const orcamentos = list.itens
  // Selecionado: das páginas carregadas; um recém-criado fora delas vem pelo id.
  // Sem seleção (ou a selecionada sumiu): mostra o mais recente.
  const daLista = orcamentos.find((o) => o.id === selId) ?? null
  const avulso = useOrcamento(selId !== null && !daLista ? selId : null)
  const sel = daLista ?? (avulso.data?.id === selId ? avulso.data : null) ?? orcamentos[0] ?? null
  const nenhumAinda = resumo.data?.every((r) => r.quantidade === 0) ?? false

  function openCreate() {
    setServerError(null)
    setCreateOpen(true)
  }

  function handleCreate(input: OrcamentoInput) {
    setServerError(null)
    create.mutate(input, {
      onSuccess: (created) => {
        setCreateOpen(false)
        setSelId(created.id)
        toast.success('Orçamento criado.')
      },
      onError: (e) =>
        setServerError(e instanceof ApiError ? e.message : 'Erro ao criar orçamento.'),
    })
  }

  function handleChangeStatus(status: StatusOrcamento, onDone?: () => void) {
    if (!sel) return
    updateStatus.mutate(
      { id: sel.id, status },
      {
        onSuccess: () => {
          toast.success('Status atualizado.')
          onDone?.()
        },
        onError: () => toast.error('Não foi possível atualizar o status.'),
      },
    )
  }

  function handleConvert() {
    if (!sel) return
    converter.mutate(sel.id, {
      onSuccess: () => toast.success('Orçamento convertido em atendimento.'),
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Não foi possível converter.'),
    })
  }

  function handleDelete() {
    if (!sel) return
    remove.mutate(sel.id, {
      onSuccess: () => {
        toast.success('Orçamento removido.')
        setConfirmDelete(false)
        setEditOpen(false)
        setSelId(null)
      },
      onError: () => {
        toast.error('Não foi possível remover.')
        setConfirmDelete(false)
      },
    })
  }

  return (
    <>
      <PageHead
        title="Orçamentos"
        sub="Do rascunho ao aprovado. Só o aprovado vira atendimento e baixa o estoque."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Novo orçamento
          </Button>
        }
      />

      <Card label="Orçamentos por status">
        <div className="pipeline">
          {ORDEM.map((st) => {
            const r = resumo.data?.find((x) => x.status === st)
            return (
              <div className="pipe" key={st}>
                <div className="top">
                  <StatusOrcamentoPill status={st} />
                </div>
                <b>{resumo.isLoading ? '…' : r?.quantidade ?? 0}</b>
                <span className="v">{brl(r?.valorTotal ?? 0)}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="split-view">
        <Card>
          <div style={{ padding: '12px 12px 0' }}>
            <SearchBox value={busca} onChange={setBusca} placeholder="Buscar pelo cliente…" label="Buscar orçamentos" />
          </div>
          <div className="q-list" role="list">
            {list.isLoading && (
              <p className="hint" style={{ margin: 0, padding: 12 }}>
                Carregando…
              </p>
            )}
            {orcamentos.map((o) => (
              <button
                key={o.id}
                className="q-item"
                role="listitem"
                type="button"
                aria-current={o.id === sel?.id}
                onClick={() => setSelId(o.id)}
              >
                <span>
                  <span className="who">{clienteNome(o)}</span>
                  <br />
                  <span className="num">
                    {numero(o.id)} · {dataCurta(o.dataRegistro)}
                  </span>
                </span>
                <span className="val">{brl(o.valorTotal)}</span>
                <span />
                <span style={{ justifySelf: 'end' }}>
                  <StatusOrcamentoPill status={o.status} />
                </span>
              </button>
            ))}
          </div>
          <CarregarMais
            carregados={orcamentos.length}
            total={list.total}
            temMais={list.hasNextPage}
            carregando={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
            rotulo="orçamentos"
          />
          {list.isError && (
            <p className="hint" role="alert" style={{ margin: 0, padding: 12 }}>
              Não foi possível carregar os orçamentos.
              {list.error instanceof ApiError ? ` ${list.error.message}` : ''}
            </p>
          )}
          {!list.isLoading && !list.isError && orcamentos.length === 0 && (
            <Empty icon="file" title={nenhumAinda || !buscaServidor ? 'Nenhum orçamento ainda' : 'Nenhum orçamento encontrado'}>
              {nenhumAinda || !buscaServidor
                ? 'Clique em Novo orçamento para montar o primeiro.'
                : 'Confira o nome do cliente ou limpe a busca.'}
            </Empty>
          )}
        </Card>
        <section className="card" aria-live="polite">
          {sel ? (
            <OrcamentoDetail
              orcamento={sel}
              clienteNome={clienteNome(sel)}
              onChangeStatus={(s) => handleChangeStatus(s)}
              onConvert={handleConvert}
              onEdit={() => setEditOpen(true)}
              busy={{ status: updateStatus.isPending, convert: converter.isPending }}
            />
          ) : (
            !list.isLoading && (
              <Empty icon="file" title="Nenhum orçamento selecionado">
                Os detalhes aparecem aqui quando houver um orçamento.
              </Empty>
            )
          )}
        </section>
      </div>

      {/* Criar */}
      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Novo orçamento">
        {createOpen && (
          <OrcamentoForm
            onSubmit={handleCreate}
            submitting={create.isPending}
            serverError={serverError}
            onCancel={() => setCreateOpen(false)}
          />
        )}
      </Drawer>

      {/* Editar (status) e excluir */}
      <Drawer
        open={editOpen && sel !== null}
        onClose={() => setEditOpen(false)}
        title={sel ? `Editar orçamento ${numero(sel.id)}` : 'Editar orçamento'}
        sub={sel ? clienteNome(sel) : undefined}
      >
        {editOpen && sel && (
          <OrcamentoEditForm
            key={sel.id}
            orcamento={sel}
            onSave={(s) => handleChangeStatus(s, () => setEditOpen(false))}
            onDelete={() => setConfirmDelete(true)}
            onCancel={() => setEditOpen(false)}
            busy={{ status: updateStatus.isPending, delete: remove.isPending }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete && sel !== null}
        title="Excluir orçamento"
        message={`Remover o orçamento ${sel ? numero(sel.id) : ''} de ${sel ? clienteNome(sel) : ''}? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
