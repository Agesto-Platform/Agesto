import { useState } from 'react'
import { aRevisar, servicosResource, useMarcarRevisado } from './resource'
import { ServicoForm } from './ServicoForm'
import {
  Button,
  Card,
  DataTable,
  Drawer,
  ConfirmDialog,
  Money,
  Pill,
  useToast,
  type Column,
} from '../../components/ui'
import { IconCheck, IconPlus, IconPencil, IconTrash } from '../../components/icons'
import { ApiError } from '../../lib/api'
import type { Servico, ServicoInput } from '../../types/api'

const iconBtn =
  'grid h-8 w-8 place-items-center rounded-[9px] text-ink-3 transition hover:bg-surface-2'

function valorDe(s: Servico): number | null {
  return s.tipoCobranca === 'PorHora' ? s.valorHora : s.valorEmpreitada
}

export function ServicosPage() {
  const list = servicosResource.useList()
  const create = servicosResource.useCreate()
  const update = servicosResource.useUpdate()
  const remove = servicosResource.useRemove()
  const revisar = useMarcarRevisado()
  const toast = useToast()
  const [soARevisar, setSoARevisar] = useState(false)

  const pendentes = aRevisar(list.data)
  const filtrando = soARevisar && pendentes.length > 0
  const rows = filtrando ? pendentes : list.data

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Servico | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Servico | null>(null)

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

  function handleSubmit(input: ServicoInput) {
    setServerError(null)
    const onSuccess = () => {
      setDrawerOpen(false)
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

  const columns: Column<Servico>[] = [
    {
      header: 'Descrição',
      cell: (s) => (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 font-medium text-ink">
            {s.descricao}
            {!s.revisado && <Pill tone="pend">A revisar</Pill>}
          </span>
          {!s.revisado && (
            <span className="text-[12px] text-ink-3">
              Criado no app por {s.criadoPorNome ?? 'um agente'}. Confira preço e descrição.
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Cobrança',
      cell: (s) => (
        <span className="text-ink-2">
          {s.tipoCobranca === 'PorHora' ? 'Por hora' : 'Empreitada'}
        </span>
      ),
    },
    {
      header: 'Valor',
      align: 'right',
      cell: (s) => {
        const v = valorDe(s)
        return v == null ? (
          <span className="text-ink-3">—</span>
        ) : (
          <span>
            <Money value={v} cents />
            {s.tipoCobranca === 'PorHora' && <span className="text-ink-3">/h</span>}
          </span>
        )
      },
    },
    {
      header: 'Ações',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          {!s.revisado && (
            <button
              type="button"
              onClick={() => handleRevisar(s)}
              disabled={revisar.isPending}
              aria-label="Marcar como revisado"
              title="Marcar como revisado"
              className={`${iconBtn} hover:text-good`}
            >
              <IconCheck className="h-[16px] w-[16px]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => openEdit(s)}
            aria-label="Editar"
            className={`${iconBtn} hover:text-brand-ink`}
          >
            <IconPencil className="h-[16px] w-[16px]" />
          </button>
          <button
            type="button"
            onClick={() => setToDelete(s)}
            aria-label="Excluir"
            className={`${iconBtn} hover:text-bad`}
          >
            <IconTrash className="h-[16px] w-[16px]" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Card className="shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Serviços</h2>
            <p className="text-[12.5px] text-ink-3">
              {list.data?.length ?? 0} cadastrados
              {pendentes.length > 0 && ` · ${pendentes.length} a revisar`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendentes.length > 0 && (
              <Button variant="ghost" onClick={() => setSoARevisar((v) => !v)}>
                {filtrando ? 'Ver todos' : `A revisar (${pendentes.length})`}
              </Button>
            )}
            <Button onClick={openCreate}>
              <IconPlus className="h-4 w-4" /> Novo
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={list.isLoading}
          getKey={(s) => s.id}
          emptyLabel="Nenhum serviço cadastrado."
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar serviço' : 'Novo serviço'}
      >
        <ServicoForm
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
        title="Excluir serviço"
        message={`Remover "${toDelete?.descricao}"? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}
