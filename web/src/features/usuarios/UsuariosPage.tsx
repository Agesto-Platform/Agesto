import { useState } from 'react'
import {
  useCreateUsuario,
  useRedefinirSenha,
  useSetAtivoUsuario,
  useUpdateUsuario,
  useUsuarios,
} from './queries'
import { UsuarioForm } from './UsuarioForm'
import { SenhaProvisoriaDialog } from './SenhaProvisoriaDialog'
import { Button, Card, ConfirmDialog, DataTable, Drawer, Pill, useToast, type Column } from '../../components/ui'
import { IconPlus, IconPencil } from '../../components/icons'
import { ApiError } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'
import type { Usuario, UsuarioCreateInput, UsuarioSenhaProvisoria } from '../../types/api'

const linkBtn =
  'rounded-[8px] px-2.5 py-1 text-[12px] font-semibold transition disabled:opacity-50'
const iconBtn =
  'grid h-8 w-8 place-items-center rounded-[9px] text-ink-3 transition hover:bg-surface-2 hover:text-brand-ink'

function ultimoAcesso(iso: string | null): string {
  if (!iso) return 'Nunca entrou'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Pendente = { tipo: 'desativar' | 'redefinir'; usuario: Usuario }

export function UsuariosPage() {
  const list = useUsuarios()
  const create = useCreateUsuario()
  const update = useUpdateUsuario()
  const setAtivo = useSetAtivoUsuario()
  const redefinir = useRedefinirSenha()
  const toast = useToast()
  const { user } = useAuth()
  const meuId = Number(user?.sub)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [senha, setSenha] = useState<UsuarioSenhaProvisoria | null>(null)
  const [pendente, setPendente] = useState<Pendente | null>(null)

  const erro = (e: unknown, padrao: string) => (e instanceof ApiError ? e.message : padrao)

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
          setSenha(criado)
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

  function confirmar() {
    if (!pendente) return
    const { tipo, usuario } = pendente
    if (tipo === 'desativar') {
      setAtivo.mutate(
        { id: usuario.id, ativo: false },
        {
          onSuccess: () => toast.success(`${usuario.nome} desativado.`),
          onError: (e) => toast.error(erro(e, 'Não foi possível desativar.')),
          onSettled: () => setPendente(null),
        },
      )
    } else {
      redefinir.mutate(usuario.id, {
        onSuccess: (r) => setSenha(r),
        onError: (e) => toast.error(erro(e, 'Não foi possível gerar a senha.')),
        onSettled: () => setPendente(null),
      })
    }
  }

  const columns: Column<Usuario>[] = [
    {
      header: 'Nome',
      cell: (u) => (
        <div>
          <span className="font-medium text-ink">{u.nome}</span>
          {u.id === meuId && <span className="ml-1.5 text-[12px] text-ink-4">(você)</span>}
          <div className="text-[12px] text-ink-3">{u.email}</div>
        </div>
      ),
    },
    {
      header: 'Perfil',
      cell: (u) => <Pill tone={u.perfil === 'Dono' ? 'brand' : 'ok'}>{u.perfil}</Pill>,
    },
    {
      header: 'Situação',
      cell: (u) =>
        !u.ativo ? (
          <Pill tone="bad">Desativado</Pill>
        ) : u.deveTrocarSenha ? (
          <Pill tone="pend">Aguardando 1º acesso</Pill>
        ) : (
          <Pill tone="ok">Ativo</Pill>
        ),
    },
    {
      header: 'Último acesso',
      cell: (u) => <span className="text-ink-3">{ultimoAcesso(u.ultimoAcessoEm)}</span>,
    },
    {
      header: 'Ações',
      align: 'right',
      cell: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => openEdit(u)} aria-label={`Editar ${u.nome}`} className={iconBtn}>
            <IconPencil className="h-[16px] w-[16px]" />
          </button>
          {u.ativo && (
            <button
              type="button"
              onClick={() => setPendente({ tipo: 'redefinir', usuario: u })}
              className={`${linkBtn} text-brand-ink hover:bg-brand-soft`}
            >
              Nova senha
            </button>
          )}
          {u.id !== meuId &&
            (u.ativo ? (
              <button
                type="button"
                onClick={() => setPendente({ tipo: 'desativar', usuario: u })}
                className={`${linkBtn} text-bad hover:bg-bad-soft`}
              >
                Desativar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => reativar(u)}
                disabled={setAtivo.isPending}
                className={`${linkBtn} text-good hover:bg-good-soft`}
              >
                Reativar
              </button>
            ))}
        </div>
      ),
    },
  ]

  const ativos = list.data?.filter((u) => u.ativo).length ?? 0

  return (
    <>
      <Card className="shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Usuários</h2>
            <p className="text-[12.5px] text-ink-3">
              {ativos} ativo{ativos === 1 ? '' : 's'} · agentes entram pelo app, donos por este painel
            </p>
          </div>
          <Button onClick={openCreate}>
            <IconPlus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={list.data}
          loading={list.isLoading}
          getKey={(u) => u.id}
          emptyLabel="Nenhum usuário cadastrado."
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
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
        title={pendente?.tipo === 'desativar' ? 'Desativar usuário' : 'Gerar nova senha'}
        message={
          pendente?.tipo === 'desativar'
            ? `${pendente.usuario.nome} perde o acesso na hora. Os atendimentos dele continuam no sistema e podem ser passados para outra pessoa.`
            : `A senha atual de ${pendente?.usuario.nome ?? ''} deixa de valer e ele precisará trocar a nova no próximo acesso.`
        }
        confirmLabel={pendente?.tipo === 'desativar' ? 'Desativar' : 'Gerar senha'}
        loadingLabel={pendente?.tipo === 'desativar' ? 'Desativando…' : 'Gerando…'}
        loading={setAtivo.isPending || redefinir.isPending}
        onConfirm={confirmar}
        onCancel={() => setPendente(null)}
      />

      <SenhaProvisoriaDialog dados={senha} onClose={() => setSenha(null)} />
    </>
  )
}
