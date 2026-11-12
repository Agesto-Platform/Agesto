import { useState, type KeyboardEvent } from 'react'
import {
  avisoDeConvite,
  useCreateUsuario,
  useReenviarConvite,
  useSetAtivoUsuario,
  useUpdateUsuario,
  useUsuarios,
} from './queries'
import { UsuarioForm } from './UsuarioForm'
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  Empty,
  PageHead,
  SearchBox,
  Seg,
  useToast,
} from '../../components/ui'
import { Icon } from '../../components/Icon'
import { ApiError } from '../../lib/api'
import { dataCurta, hora, iniciais } from '../../lib/format'
import { useAuth } from '../../auth/useAuth'
import type { PerfilUsuario, Usuario, UsuarioConvite, UsuarioCreateInput } from '../../types/api'
import './usuarios.css'

type Pendente = { tipo: 'desativar'; usuario: Usuario }
type Filtro = 'todos' | PerfilUsuario

const PAPEL: Record<PerfilUsuario, string> = {
  Agente: 'Usa o app em campo',
  Dono: 'Acessa este painel',
}

/** "20 out. · 14:30" */
function acesso(iso: string | null): string | null {
  return iso ? `${dataCurta(iso)} · ${hora(iso)}` : null
}

function Situacao({ u }: { u: Usuario }) {
  if (!u.ativo)
    return (
      <Badge tone="neg" dot>
        Desativado
      </Badge>
    )
  if (u.convitePendente)
    return (
      <Badge tone="warn" dot>
        Convite pendente
      </Badge>
    )
  if (u.deveTrocarSenha)
    return (
      <Badge tone="warn" dot>
        Aguardando 1º acesso
      </Badge>
    )
  return (
    <Badge tone="ok" dot>
      Ativo
    </Badge>
  )
}

/** Painel da direita no desenho do detalhe de cliente: perfil, fatos e acesso. */
function UsuarioDetalhe({
  u,
  eu,
  onEdit,
  onReenviar,
  reenviando,
  onDesativar,
  onReativar,
  reativando,
}: {
  u: Usuario
  eu: boolean
  onEdit: () => void
  onReenviar: () => void
  reenviando: boolean
  onDesativar: () => void
  onReativar: () => void
  reativando: boolean
}) {
  const ultimo = acesso(u.ultimoAcessoEm)
  return (
    <section className="card usr-detail" aria-live="polite">
      <div className="profile">
        <span className="avatar">{iniciais(u.nome)}</span>
        <h2>
          {u.nome}
          {eu && <Badge>você</Badge>}
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" variant="primary" icon="pencil" onClick={onEdit}>
            Editar
          </Button>
          {u.ativo && u.convitePendente && (
            <Button size="sm" icon="mail" onClick={onReenviar} disabled={reenviando}>
              {reenviando ? 'Reenviando…' : 'Reenviar convite'}
            </Button>
          )}
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt>
            <Icon name="mail" className="sm" />
          </dt>
          <dd>
            {u.email}
            <span>Login de acesso</span>
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="user" className="sm" />
          </dt>
          <dd>
            {u.perfil}
            <span>{PAPEL[u.perfil]}</span>
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="clock" className="sm" />
          </dt>
          <dd>
            {ultimo ?? <span>Nunca entrou</span>}
            {ultimo && <span>Último acesso</span>}
          </dd>
        </div>
      </dl>
      <div className="hist">
        <h3>Acesso</h3>
        <p className="hint" style={{ margin: '0 0 10px' }}>
          {!u.ativo
            ? 'Sem acesso. Os atendimentos dele continuam no sistema.'
            : u.convitePendente
              ? 'Recebeu o convite por email e ainda não criou a senha. O link vale por 72 horas.'
              : u.deveTrocarSenha
                ? 'Entra com a senha provisória e troca no primeiro acesso.'
                : 'Pode entrar normalmente. Se esquecer a senha, usa "Esqueci a senha" na tela de entrada.'}
        </p>
        {eu ? (
          <p className="hint" style={{ margin: 0 }}>
            Você não pode desativar o próprio acesso.
          </p>
        ) : u.ativo ? (
          <Button size="sm" onClick={onDesativar}>
            Desativar
          </Button>
        ) : (
          <Button size="sm" icon="check" onClick={onReativar} disabled={reativando}>
            Reativar
          </Button>
        )}
      </div>
    </section>
  )
}

export function UsuariosPage() {
  const list = useUsuarios()
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const setAtivo = useSetAtivoUsuario()
  const reenviar = useReenviarConvite()
  const toast = useToast()
  const { user } = useAuth()
  const meuId = Number(user?.sub)

  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [selId, setSelId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendente, setPendente] = useState<Pendente | null>(null)

  const erro = (e: unknown, padrao: string) => (e instanceof ApiError ? e.message : padrao)
  // Depois de criar ou reenviar: confirma o envio ou avisa que o email está desligado.
  const avisar = (r: UsuarioConvite) => {
    const aviso = avisoDeConvite(r)
    if (aviso.ok) toast.success(aviso.texto)
    else toast.error(aviso.texto)
  }

  const todos = list.data ?? []
  const termo = q.trim().toLowerCase()
  const rows = todos
    .filter((u) => filtro === 'todos' || u.perfil === filtro)
    .filter((u) => !termo || `${u.nome} ${u.email}`.toLowerCase().includes(termo))
  const sel = rows.find((u) => u.id === selId) ?? rows[0] ?? null
  const ativos = todos.filter((u) => u.ativo).length

  function openCreate() {
    setEditing(null)
    setServerError(null)
    setDrawerOpen(true)
  }
  function openEdit(u: Usuario) {
    setEditing(u)
    setServerError(null)
    setDrawerOpen(true)
  }
  function onRowKey(e: KeyboardEvent, u: Usuario) {
    if (e.key === 'Enter') setSelId(u.id)
  }

  function handleSubmit(input: UsuarioCreateInput) {
    setServerError(null)
    const onError = (e: unknown) => setServerError(erro(e, 'Erro ao salvar.'))
    if (editing) {
      update.mutate(
        { id: editing.id, body: { nome: input.nome, perfil: input.perfil } },
        {
          onSuccess: () => {
            setDrawerOpen(false)
            toast.success('Usuário atualizado.')
          },
          onError,
        },
      )
    } else {
      create.mutate(input, {
        onSuccess: (criado) => {
          setDrawerOpen(false)
          setSelId(criado.usuario.id)
          avisar(criado)
        },
        onError,
      })
    }
  }

  function reativar(u: Usuario) {
    setAtivo.mutate(
      { id: u.id, ativo: true },
      {
        onSuccess: () => toast.success(`${u.nome} reativado.`),
        onError: (e) => toast.error(erro(e, 'Não foi possível reativar.')),
      },
    )
  }

  function reenviarConvite(u: Usuario) {
    reenviar.mutate(u.id, {
      onSuccess: avisar,
      onError: (e) => toast.error(erro(e, 'Não foi possível reenviar o convite.')),
    })
  }

  function confirmar() {
    if (!pendente) return
    const { usuario } = pendente
    setAtivo.mutate(
      { id: usuario.id, ativo: false },
      {
        onSuccess: () => toast.success(`${usuario.nome} desativado.`),
        onError: (e) => toast.error(erro(e, 'Não foi possível desativar.')),
        onSettled: () => setPendente(null),
      },
    )
  }

  return (
    <>
      <PageHead
        title="Usuários"
        badge={list.data && <Badge>{ativos === 1 ? '1 ativo' : `${ativos} ativos`}</Badge>}
        sub="Quem acessa o Agesto: agentes entram pelo app, donos por este painel. Cada pessoa recebe um convite por email e cria a própria senha."
        actions={
          <Button variant="primary" icon="plus" onClick={openCreate}>
            Novo usuário
          </Button>
        }
      />

      <div className="grid g-main-side">
        <section className="card">
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder="Buscar por nome ou email" label="Buscar usuário" />
            <Seg<Filtro>
              label="Perfil"
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'Agente', label: 'Agentes' },
                { value: 'Dono', label: 'Donos' },
              ]}
            />
            <span className="hint" style={{ marginLeft: 'auto' }}>
              {list.data && (rows.length === 1 ? '1 usuário' : `${rows.length} usuários`)}
            </span>
          </div>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th>Último acesso</th>
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
                      Não foi possível carregar os usuários
                      {list.error instanceof ApiError ? `: ${list.error.message}` : '.'}
                    </td>
                  </tr>
                )}
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className={`row-click${u.id === sel?.id ? ' is-selected' : ''}`}
                    tabIndex={0}
                    onClick={() => setSelId(u.id)}
                    onKeyDown={(e) => onRowKey(e, u)}
                  >
                    <td>
                      <div className="cell">
                        <span className="avatar sm">{iniciais(u.nome)}</span>
                        <span className="strong">{u.nome}</span>
                        {u.id === meuId && <span className="muted">(você)</span>}
                      </div>
                    </td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <Badge tone={u.perfil === 'Dono' ? 'brand' : 'neutral'}>{u.perfil}</Badge>
                    </td>
                    <td>
                      <Situacao u={u} />
                    </td>
                    <td>{acesso(u.ultimoAcessoEm) ?? <span className="muted">Nunca entrou</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.isSuccess && rows.length === 0 && (
            <div className="empty">
              <span className="ic">
                <Icon name="users" />
              </span>
              <b>{todos.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum usuário encontrado'}</b>
              <p>
                {todos.length === 0
                  ? 'Cadastre os agentes que vão usar o app em campo.'
                  : 'Tente outro nome ou email.'}
              </p>
              {todos.length === 0 && (
                <Button size="sm" variant="primary" icon="plus" style={{ marginTop: 6 }} onClick={openCreate}>
                  Novo usuário
                </Button>
              )}
            </div>
          )}
        </section>

        {sel ? (
          <UsuarioDetalhe
            u={sel}
            eu={sel.id === meuId}
            onEdit={() => openEdit(sel)}
            onReenviar={() => reenviarConvite(sel)}
            reenviando={reenviar.isPending}
            onDesativar={() => setPendente({ tipo: 'desativar', usuario: sel })}
            onReativar={() => reativar(sel)}
            reativando={setAtivo.isPending}
          />
        ) : (
          <section className="card" aria-live="polite">
            <Empty icon="user" title="Nenhum usuário selecionado">
              {list.isLoading ? 'Carregando…' : 'Escolha alguém na lista para ver o acesso.'}
            </Empty>
          </section>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        sub={editing?.email}
      >
        <UsuarioForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onSubmit={handleSubmit}
          submitting={create.isPending || update.isPending}
          serverError={serverError}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      <ConfirmDialog
        open={pendente !== null}
        title="Desativar usuário"
        message={`${pendente?.usuario.nome ?? ''} perde o acesso na hora. Os atendimentos dele continuam no sistema e podem ser passados para outra pessoa.`}
        confirmLabel="Desativar"
        loadingLabel="Desativando…"
        loading={setAtivo.isPending}
        onConfirm={confirmar}
        onCancel={() => setPendente(null)}
      />
    </>
  )
}
