import { useState, type FormEvent } from 'react'
import { Badge, Button, ConfirmDialog, DataTable, Drawer, PageHead, TextField, useToast, type Column } from '../components/ui'
import { ApiError } from '../lib/api'
import { dataCurta } from '../lib/format'
import { avisoDeEnvio, useAtivoAdmin, useConvidarAdmin, useEquipeAdmin, useReenviarConviteAdmin } from './queries'
import { adminLogado } from './sessao'
import type { AdminConta, AdminConvidarInput, ConviteEnviado } from './types'

const VAZIO: AdminConvidarInput = { nome: '', email: '' }

const COLUNAS: Column<AdminConta>[] = [
  {
    header: 'Pessoa',
    cell: (a) => (
      <div className="adm-cell">
        <b>{a.nome}</b>
        <span>{a.email}</span>
      </div>
    ),
  },
  { header: 'Último acesso', cell: (a) => (a.ultimoAcessoEm ? dataCurta(a.ultimoAcessoEm) : 'Nunca') },
  { header: 'Desde', cell: (a) => dataCurta(a.createdAt) },
  {
    header: 'Situação',
    cell: (a) =>
      a.ativo && a.convitePendente ? (
        <Badge tone="warn" dot>
          Convite pendente
        </Badge>
      ) : a.ativo ? (
        <Badge tone="ok" dot>
          Ativo
        </Badge>
      ) : (
        <Badge tone="neg" dot>
          Desativado
        </Badge>
      ),
  },
]

/** Quem da equipe do Agesto tem acesso à área de superadmin. */
export function AdminEquipePage() {
  const toast = useToast()
  const equipe = useEquipeAdmin()
  const criar = useConvidarAdmin()
  const reenviar = useReenviarConviteAdmin()
  const ativo = useAtivoAdmin()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<AdminConta | null>(null)
  const meuId = adminLogado()?.sub

  const avisar = (r: ConviteEnviado, oQue: string) => {
    const aviso = avisoDeEnvio(r, oQue)
    if (aviso.ok) toast.success(aviso.texto)
    else toast.error(aviso.texto)
  }

  const reenviarConvite = async (a: AdminConta) => {
    try {
      avisar(await reenviar.mutateAsync(a.id), 'Convite reenviado')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível reenviar o convite.')
    }
  }

  const confirmarAtivo = async () => {
    if (!alvo) return
    try {
      await ativo.mutateAsync({ id: alvo.id, ativo: !alvo.ativo })
      toast.success(alvo.ativo ? 'Acesso removido. A sessão da pessoa caiu na hora.' : 'Acesso devolvido.')
      setAlvo(null)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível concluir.')
    }
  }

  const colunas: Column<AdminConta>[] = [
    ...COLUNAS,
    {
      header: '',
      align: 'right',
      cell: (a) =>
        String(a.id) === meuId ? (
          <span className="muted">Você</span>
        ) : (
          <div className="adm-acoes">
            {a.ativo && a.convitePendente && (
              <Button size="sm" icon="mail" onClick={() => reenviarConvite(a)} disabled={reenviar.isPending}>
                Reenviar convite
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setAlvo(a)}>
              {a.ativo ? 'Desativar' : 'Reativar'}
            </Button>
          </div>
        ),
    },
  ]

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim()) {
      setErro('Preencha o nome e o email.')
      return
    }
    setErro(null)
    try {
      const r = await criar.mutateAsync({ nome: form.nome.trim(), email: form.email.trim() })
      setAberto(false)
      setForm(VAZIO)
      avisar(r, 'Convite enviado')
    } catch (err) {
      setErro(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível convidar.')
    }
  }

  const campo = (k: keyof AdminConvidarInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <PageHead
        title="Equipe"
        sub="Pessoas do Agesto com acesso a esta área."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAberto(true)}>
            Convidar administrador
          </Button>
        }
      />
      <ConfirmDialog
        open={alvo !== null}
        title={alvo?.ativo ? `Desativar ${alvo.nome}?` : `Reativar ${alvo?.nome ?? ''}?`}
        message={
          alvo?.ativo
            ? 'A pessoa perde o acesso à área de superadmin na hora. Use quando alguém sair da equipe.'
            : 'A pessoa volta a entrar com a senha que já tinha.'
        }
        confirmLabel={alvo?.ativo ? 'Desativar' : 'Reativar'}
        loading={ativo.isPending}
        onConfirm={confirmarAtivo}
        onCancel={() => setAlvo(null)}
      />
      <DataTable columns={colunas} rows={equipe.data} getKey={(a) => a.id} loading={equipe.isLoading} empty={{ title: 'Ninguém cadastrado' }} />

      <Drawer open={aberto} onClose={() => setAberto(false)} title="Convidar administrador" sub="Acesso total a todas as empresas. Convide só quem é da equipe.">
        <form className="form" onSubmit={salvar} noValidate>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Nome" value={form.nome} onChange={campo('nome')} maxLength={120} required />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={campo('email')}
            maxLength={150}
            hint="A pessoa recebe um convite neste email para criar a própria senha (o link vale por 72 horas)."
            required
          />
          <div className="form-actions">
            <Button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  )
}
