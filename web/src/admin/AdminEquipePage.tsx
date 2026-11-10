import { useState, type FormEvent } from 'react'
import { Badge, Button, ConfirmDialog, DataTable, Drawer, PageHead, TextField, useToast, type Column } from '../components/ui'
import { ApiError } from '../lib/api'
import { dataCurta } from '../lib/format'
import { useAtivoAdmin, useCriarAdmin, useEquipeAdmin } from './queries'
import { adminLogado } from './sessao'
import type { AdminConta, AdminCriarInput } from './types'

const VAZIO: AdminCriarInput = { nome: '', email: '', senha: '' }

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
      a.ativo ? (
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
  const criar = useCriarAdmin()
  const ativo = useAtivoAdmin()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<AdminConta | null>(null)
  const meuId = adminLogado()?.sub

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
          <Button size="sm" variant="ghost" onClick={() => setAlvo(a)}>
            {a.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        ),
    },
  ]

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 12) {
      setErro('Preencha nome e email. A senha precisa de pelo menos 12 caracteres.')
      return
    }
    setErro(null)
    try {
      await criar.mutateAsync({ ...form, nome: form.nome.trim(), email: form.email.trim() })
      setAberto(false)
      setForm(VAZIO)
      toast.success('Administrador cadastrado. Passe a senha para a pessoa por um canal seguro.')
    } catch (err) {
      setErro(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível cadastrar.')
    }
  }

  const campo = (k: keyof AdminCriarInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <PageHead
        title="Equipe"
        sub="Pessoas do Agesto com acesso a esta área."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAberto(true)}>
            Novo administrador
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

      <Drawer open={aberto} onClose={() => setAberto(false)} title="Novo administrador" sub="Acesso total a todas as empresas. Cadastre só quem é da equipe.">
        <form className="form" onSubmit={salvar} noValidate>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Nome" value={form.nome} onChange={campo('nome')} maxLength={120} required />
          <TextField label="Email" type="email" value={form.email} onChange={campo('email')} maxLength={150} required />
          <TextField
            label="Senha"
            type="password"
            value={form.senha}
            onChange={campo('senha')}
            maxLength={128}
            autoComplete="new-password"
            hint="Pelo menos 12 caracteres."
            required
          />
          <div className="form-actions">
            <Button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Salvando…' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  )
}
