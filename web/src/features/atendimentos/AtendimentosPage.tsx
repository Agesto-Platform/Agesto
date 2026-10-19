import { useState } from 'react'
import {
  useAtendimentos,
  useCreateAtendimento,
  useUpdateAtendimento,
  useDeleteAtendimento,
} from './queries'
import { AtendimentoForm } from './AtendimentoForm'
import { AtendimentoDetail } from './AtendimentoDetail'
import { StatusAtendimentoPill } from './status'
import { clientesResource } from '../clientes/resource'
import { produtosResource } from '../produtos/resource'
import { servicosResource } from '../servicos/resource'
import { useUsuarios, responsaveis, nomeUsuario } from '../usuarios/queries'
import { Button, Card, DataTable, Drawer, Money, useToast, type Column } from '../../components/ui'
import { IconPlus } from '../../components/icons'
import { ApiError } from '../../lib/api'
import type { Atendimento, AtendimentoInput, StatusAtendimento } from '../../types/api'

function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function AtendimentosPage() {
  const list = useAtendimentos()
  const create = useCreateAtendimento()
  const update = useUpdateAtendimento()
  const remove = useDeleteAtendimento()
  const toast = useToast()

  const clientes = clientesResource.useList()
  const produtos = produtosResource.useList()
  const servicos = servicosResource.useList()
  const usuarios = useUsuarios()

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const clienteNome = (id: number) =>
    clientes.data?.find((c) => c.id === id)?.nome ?? `Cliente #${id}`
  const detail = list.data?.find((a) => a.id === detailId) ?? null

  function handleCreate(input: AtendimentoInput) {
    setServerError(null)
    create.mutate(input, {
      onSuccess: (created) => {
        setCreateOpen(false)
        setDetailId(created.id)
        toast.success('Atendimento criado.')
      },
      onError: (e) =>
        setServerError(e instanceof ApiError ? e.message : 'Erro ao criar atendimento.'),
    })
  }

  function handleUpdate(status: StatusAtendimento, dataAgendada: string | null, responsavelId: number) {
    if (detailId == null) return
    update.mutate(
      { id: detailId, body: { status, dataAgendada, responsavelId } },
      {
        onSuccess: () => toast.success('Atendimento atualizado.'),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Não foi possível atualizar.'),
      },
    )
  }

  function handleDelete() {
    if (detailId == null) return
    remove.mutate(detailId, {
      onSuccess: () => {
        toast.success('Atendimento removido.')
        setDetailId(null)
      },
      onError: () => toast.error('Não foi possível remover.'),
    })
  }

  const columns: Column<Atendimento>[] = [
    { header: 'Cliente', cell: (a) => <span className="font-medium text-ink">{clienteNome(a.clienteId)}</span> },
    { header: 'Responsável', cell: (a) => <span className="text-ink-2">{nomeUsuario(usuarios.data, a.usuarioId)}</span> },
    { header: 'Agendada', cell: (a) => <span className="text-ink-3">{dataCurta(a.dataAgendada)}</span> },
    { header: 'Status', cell: (a) => <StatusAtendimentoPill status={a.status} /> },
    { header: 'Valor', align: 'right', cell: (a) => <Money value={a.valorTotal} cents /> },
    { header: 'Margem', align: 'right', cell: (a) => <Money value={a.margem} cents className="font-semibold text-good" /> },
    {
      header: '',
      align: 'right',
      cell: (a) => (
        <button
          type="button"
          onClick={() => setDetailId(a.id)}
          className="rounded-[8px] px-2.5 py-1 text-[12px] font-semibold text-brand-ink transition hover:bg-brand-soft"
        >
          Ver
        </button>
      ),
    },
  ]

  return (
    <>
      <Card className="shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Atendimentos</h2>
            <p className="text-[12.5px] text-ink-3">{list.data?.length ?? 0} no total</p>
          </div>
          <Button onClick={() => { setServerError(null); setCreateOpen(true) }}>
            <IconPlus className="h-4 w-4" /> Novo
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={list.data}
          loading={list.isLoading}
          getKey={(a) => a.id}
          emptyLabel="Nenhum atendimento registrado."
        />
      </Card>

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Novo atendimento">
        {createOpen && (
          <AtendimentoForm
            clientes={clientes.data ?? []}
            responsaveis={responsaveis(usuarios.data)}
            onSubmit={handleCreate}
            submitting={create.isPending}
            serverError={serverError}
            onCancel={() => setCreateOpen(false)}
          />
        )}
      </Drawer>

      <Drawer
        open={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `Atendimento #${detail.id}` : 'Atendimento'}
      >
        {detail && (
          <AtendimentoDetail
            atendimento={detail}
            clienteNome={clienteNome(detail.clienteId)}
            responsaveis={usuarios.data ?? []}
            produtos={produtos.data ?? []}
            servicos={servicos.data ?? []}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            busy={{ update: update.isPending, delete: remove.isPending }}
          />
        )}
      </Drawer>
    </>
  )
}
