import { useState } from 'react'
import {
  useAtendimento,
  useAtendimentoContagem,
  useAtendimentosPaginados,
  useCreateAtendimento,
  useUpdateAtendimento,
  useDeleteAtendimento,
} from './queries'
import { AtendimentoForm } from './AtendimentoForm'
import { AtendimentoDetail } from './AtendimentoDetail'
import { StatusAtendimentoPill } from './status'
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
  CarregarMais,
  brl,
  useToast,
  type Column,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { dataCurta, iniciais, semanaHora } from '../../lib/format'
import { useDebounced } from '../../lib/paginacao'
import type { Atendimento, AtendimentoContagem, AtendimentoInput, StatusAtendimento } from '../../types/api'

type Aba = 'todos' | StatusAtendimento

const ABAS: { value: Aba; label: string; conta: keyof AtendimentoContagem }[] = [
  { value: 'todos', label: 'Todos', conta: 'todos' },
  { value: 'Pendente', label: 'Pendentes', conta: 'pendente' },
  { value: 'Concluido', label: 'Concluídos', conta: 'concluido' },
  { value: 'Cancelado', label: 'Cancelados', conta: 'cancelado' },
]

/** Data que aparece na lista (e a ordena, no servidor): a agendada, senão a de registro. */
const dataRef = (a: Atendimento) => a.dataAgendada ?? a.dataRegistro

export function AtendimentosPage() {
  const [aba, setAba] = useState<Aba>('todos')
  const [busca, setBusca] = useState('')
  const buscaServidor = useDebounced(busca.trim())
  // PAG-01: 50 por vez, com aba e busca no servidor; os números das abas vêm à parte.
  const list = useAtendimentosPaginados({ status: aba === 'todos' ? undefined : aba, busca: buscaServidor || undefined })
  const contagem = useAtendimentoContagem()
  const create = useCreateAtendimento()
  const update = useUpdateAtendimento()
  const remove = useDeleteAtendimento()
  const toast = useToast()

  // PAG-01 fase 2: cliente, produto e serviço são escolhidos por busca no servidor.
  const usuarios = useUsuarios()

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const linhas = list.itens
  // O detalhe vem das páginas carregadas; um recém-criado fora delas vem pelo id.
  const daLista = linhas.find((a) => a.id === detailId) ?? null
  const avulso = useAtendimento(detailId !== null && !daLista ? detailId : null)
  const detail = daLista ?? (avulso.data?.id === detailId ? avulso.data : null)

  const clienteNome = (a: Atendimento) => a.clienteNome ?? `Cliente #${a.clienteId}`
  const nenhumAinda = contagem.data?.todos === 0

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
        const nome = clienteNome(a)
        return (
          <div className="cell">
            <span className="avatar sm">{iniciais(nome)}</span>
            <span>
              <span className="strong">{nome}</span>
              <span className="sub">{a.clienteTelefone || 'sem telefone'}</span>
            </span>
          </div>
        )
      },
    },
    {
      header: 'Serviço',
      className: 'wrap',
      cell: (a) => {
        const r = a.resumo
        return (
          <>
            {r ? (
              <span>{r}</span>
            ) : (
              <span className="muted" title="Atendimento sem itens">
                —
              </span>
            )}
            <span className="sub muted" style={{ display: 'block', fontSize: 12 }}>
              {a.enderecoResumo ?? 'sem endereço'}
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
          aria-label={`Ações de ${clienteNome(a)}`}
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
          tabs={ABAS.map((t) => ({ value: t.value, label: t.label, count: contagem.data?.[t.conta] }))}
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
            {list.isLoading ? '' : `${list.total} ${list.total === 1 ? 'atendimento' : 'atendimentos'}`}
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
            nenhumAinda
              ? { title: 'Nenhum atendimento ainda', text: 'Clique em Novo atendimento para registrar o primeiro.', icon: 'wrench' }
              : { title: 'Nenhum atendimento encontrado', text: 'Confira a grafia do nome ou troque a aba de status.' }
          }
        />
        <CarregarMais
          carregados={linhas.length}
          total={list.total}
          temMais={list.hasNextPage}
          carregando={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}
          rotulo="atendimentos"
        />
      </section>

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Novo atendimento">
        {createOpen && (
          <AtendimentoForm
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
        sub={detail ? clienteNome(detail) : undefined}
      >
        {detail && (
          <AtendimentoDetail
            key={detail.id}
            atendimento={detail}
            responsaveis={usuarios.data ?? []}
            onUpdate={handleUpdate}
            onDelete={() => setConfirmDelete(true)}
            busy={{ update: update.isPending, delete: remove.isPending }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete && detail !== null}
        title="Excluir atendimento"
        message={`Remover o atendimento #${detail?.id} de ${detail ? clienteNome(detail) : ''}? Esta ação não pode ser desfeita.`}
        loading={remove.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
