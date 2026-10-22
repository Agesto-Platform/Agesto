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
import { useUsuarios, responsaveis } from '../usuarios/queries'
import {
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  IconButton,
  PageHead,
  SearchBox,
  Tabs,
  brl,
  useToast,
  type Column,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { useAgenda } from '../../lib/queries'
import { dataCurta, iniciais, semanaHora } from '../../lib/format'
import type { Atendimento, AtendimentoInput, Cliente, StatusAtendimento } from '../../types/api'

type Aba = 'todos' | StatusAtendimento

const ABAS: { value: Aba; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendentes' },
  { value: 'Concluido', label: 'Concluídos' },
  { value: 'Cancelado', label: 'Cancelados' },
]

/** "R. das Acácias, 120 — Centro" a partir do cadastro do cliente. */
function endereco(c: Cliente | undefined): string | null {
  if (!c) return null
  const rua = [c.logradouro, c.numero].filter(Boolean).join(', ')
  return [rua, c.bairro].filter(Boolean).join(' — ') || null
}

/** Data que ordena e aparece na lista: a agendada, senão a de registro. */
const dataRef = (a: Atendimento) => a.dataAgendada ?? a.dataRegistro

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
  // O resumo do serviço só vem na agenda (atendimentos agendados no ano).
  const agenda = useAgenda('ano')

  const [aba, setAba] = useState<Aba>('todos')
  const [busca, setBusca] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const cliente = (id: number) => clientes.data?.find((c) => c.id === id)
  const clienteNome = (id: number) => cliente(id)?.nome ?? `Cliente #${id}`
  const resumo = (id: number) => agenda.data?.find((a) => a.id === id)?.resumo || null
  const detail = list.data?.find((a) => a.id === detailId) ?? null

  const todos = list.data ?? []
  const q = busca.trim().toLowerCase()
  const linhas = todos
    .filter((a) => aba === 'todos' || a.status === aba)
    .filter((a) => !q || `${clienteNome(a.clienteId)} ${resumo(a.id) ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => dataRef(b).localeCompare(dataRef(a)))

  function openCreate() {
    setServerError(null)
    setCreateOpen(true)
  }

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
        setConfirmDelete(false)
        setDetailId(null)
      },
      onError: () => {
        toast.error('Não foi possível remover.')
        setConfirmDelete(false)
      },
    })
  }

  const columns: Column<Atendimento>[] = [
    {
      header: 'Data',
      cell: (a) => (
        <>
          <span className="strong">{dataCurta(dataRef(a))}</span>
          <span className="sub muted" style={{ display: 'block', fontSize: 12 }}>
            {a.dataAgendada ? semanaHora(a.dataAgendada) : 'sem agendamento'}
          </span>
        </>
      ),
    },
    {
      header: 'Cliente',
      cell: (a) => {
        const nome = clienteNome(a.clienteId)
        return (
          <div className="cell">
            <span className="avatar sm">{iniciais(nome)}</span>
            <span>
              <span className="strong">{nome}</span>
              <span className="sub">{cliente(a.clienteId)?.telefone || 'sem telefone'}</span>
            </span>
          </div>
        )
      },
    },
    {
      header: 'Serviço',
      className: 'wrap',
      cell: (a) => {
        const r = resumo(a.id)
        return (
          <>
            {r ? (
              <span>{r}</span>
            ) : (
              <span className="muted" title="O resumo do serviço só aparece para atendimentos agendados neste ano">
                —
              </span>
            )}
            <span className="sub muted" style={{ display: 'block', fontSize: 12 }}>
              {endereco(cliente(a.clienteId)) ?? 'sem endereço'}
            </span>
          </>
        )
      },
    },
    { header: 'Status', cell: (a) => <StatusAtendimentoPill status={a.status} /> },
    { header: 'Total', align: 'right', className: 'strong', cell: (a) => brl(a.valorTotal) },
    {
      header: 'Margem',
      align: 'right',
      className: 'muted',
      cell: (a) => (a.custoTotal > 0 ? brl(a.margem) : <span title="Custo ainda não preenchido">—</span>),
    },
    {
      header: <span className="sr-only">Ações</span>,
      align: 'right',
      cell: (a) => (
        <IconButton
          aria-label={`Ações de ${clienteNome(a.clienteId)}`}
          style={{ width: 28, height: 28 }}
          onClick={(e) => {
            e.stopPropagation()
            setDetailId(a.id)
          }}
        >
          <Icon name="more" />
        </IconButton>
      ),
    },
  ]

  return (
    <>
      <PageHead
        title="Atendimentos"
        sub="Tudo o que está agendado, feito ou cancelado."
        actions={
          <>
            <Button icon="download">Exportar</Button>
            <Button variant="primary" icon="plus" onClick={openCreate}>
              Novo atendimento
            </Button>
          </>
        }
      />

      <section className="card">
        <Tabs
          label="Status do atendimento"
          value={aba}
          onChange={setAba}
          tabs={ABAS.map((t) => ({
            ...t,
            count: todos.filter((a) => t.value === 'todos' || a.status === t.value).length,
          }))}
        />
        <div className="toolbar">
          <SearchBox
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por cliente ou serviço"
            label="Buscar atendimento"
          />
          <Button size="sm" icon="filter">
            Filtros
          </Button>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {list.isLoading ? '' : `${linhas.length} ${linhas.length === 1 ? 'atendimento' : 'atendimentos'}`}
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={linhas}
          loading={list.isLoading}
          getKey={(a) => a.id}
          onRowClick={(a) => setDetailId(a.id)}
          isSelected={(a) => a.id === detailId}
          empty={
            todos.length === 0
              ? { title: 'Nenhum atendimento ainda', text: 'Clique em Novo atendimento para registrar o primeiro.', icon: 'wrench' }
              : { title: 'Nenhum atendimento encontrado', text: 'Confira a grafia do nome ou troque a aba de status.' }
          }
        />
      </section>

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
        sub={detail ? clienteNome(detail.clienteId) : undefined}
      >
        {detail && (
          <AtendimentoDetail
            key={detail.id}
            atendimento={detail}
            responsaveis={usuarios.data ?? []}
            produtos={produtos.data ?? []}
            servicos={servicos.data ?? []}
            onUpdate={handleUpdate}
            onDelete={() => setConfirmDelete(true)}
            busy={{ update: update.isPending, delete: remove.isPending }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete && detail !== null}
        title="Excluir atendimento"
        message={`Remover o atendimento #${detail?.id} de ${detail ? clienteNome(detail.clienteId) : ''}? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
