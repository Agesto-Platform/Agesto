import { useState } from 'react'
import {
  useOrcamentos,
  useCreateOrcamento,
  useUpdateStatus,
  useDeleteOrcamento,
  useConverterOrcamento,
} from './queries'
import { OrcamentoForm } from './OrcamentoForm'
import { OrcamentoDetail, OrcamentoEditForm } from './OrcamentoDetail'
import { StatusOrcamentoPill } from './status'
import { numero } from './labels'
import { clientesResource } from '../clientes/resource'
import { produtosResource } from '../produtos/resource'
import { servicosResource } from '../servicos/resource'
import { Button, Card, ConfirmDialog, Drawer, Empty, PageHead, brl, useToast } from '../../components/ui'
import { ApiError } from '../../lib/api'
import { dataCurta } from '../../lib/format'
import type { OrcamentoInput, StatusOrcamento } from '../../types/api'
import './orcamentos.css'

const ORDEM: StatusOrcamento[] = ['Rascunho', 'Enviado', 'Aprovado', 'Recusado']

export function OrcamentosPage() {
  const list = useOrcamentos()
  const create = useCreateOrcamento()
  const updateStatus = useUpdateStatus()
  const remove = useDeleteOrcamento()
  const converter = useConverterOrcamento()
  const toast = useToast()

  const clientes = clientesResource.useList()
  const produtos = produtosResource.useList()
  const servicos = servicosResource.useList()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selId, setSelId] = useState<number | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const clienteNome = (id: number) =>
    clientes.data?.find((c) => c.id === id)?.nome ?? `Cliente #${id}`

  const orcamentos = [...(list.data ?? [])].sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro) || a.id - b.id)
  // Sem seleção (ou a selecionada sumiu): mostra o mais recente.
  const sel = orcamentos.find((o) => o.id === selId) ?? orcamentos[0] ?? null

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
            const l = orcamentos.filter((o) => o.status === st)
            return (
              <div className="pipe" key={st}>
                <div className="top">
                  <StatusOrcamentoPill status={st} />
                </div>
                <b>{l.length}</b>
                <span className="v">{brl(l.reduce((s, o) => s + o.valorTotal, 0))}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="split-view">
        <Card>
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
                  <span className="who">{clienteNome(o.clienteId)}</span>
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
          {!list.isLoading && orcamentos.length === 0 && (
            <Empty icon="file" title="Nenhum orçamento ainda">
              Clique em Novo orçamento para montar o primeiro.
            </Empty>
          )}
        </Card>
        <section className="card" aria-live="polite">
          {sel ? (
            <OrcamentoDetail
              orcamento={sel}
              clienteNome={clienteNome(sel.clienteId)}
              produtos={produtos.data ?? []}
              servicos={servicos.data ?? []}
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
            clientes={clientes.data ?? []}
            produtos={produtos.data ?? []}
            servicos={servicos.data ?? []}
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
        sub={sel ? clienteNome(sel.clienteId) : undefined}
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
        message={`Remover o orçamento ${sel ? numero(sel.id) : ''} de ${sel ? clienteNome(sel.clienteId) : ''}? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
