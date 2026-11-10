import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, DataTable, Drawer, PageHead, SearchBox, TextField, type Column } from '../components/ui'
import { SenhaProvisoriaDialog } from '../features/usuarios/SenhaProvisoriaDialog'
import { ApiError } from '../lib/api'
import { dataCurta } from '../lib/format'
import { useCriarEmpresa, useEmpresasAdmin } from './queries'
import type { EmpresaAdminCriarInput, EmpresaAdminResumo } from './types'

const VAZIO: EmpresaAdminCriarInput = { nomeEmpresa: '', documento: '', nomeDono: '', emailDono: '' }

const COLUNAS: Column<EmpresaAdminResumo>[] = [
  {
    header: 'Empresa',
    cell: (e) => (
      <div className="adm-cell">
        <b>{e.nome}</b>
        {e.documento && <span>{e.documento}</span>}
      </div>
    ),
  },
  {
    header: 'Dono',
    cell: (e) => (
      <div className="adm-cell">
        <span className="ink">{e.donoNome ?? '—'}</span>
        {e.donoEmail && <span>{e.donoEmail}</span>}
      </div>
    ),
  },
  { header: 'Usuários', cell: (e) => `${e.usuariosAtivos} de ${e.totalUsuarios} ativos` },
  { header: 'Último acesso', cell: (e) => (e.ultimoAcessoEm ? dataCurta(e.ultimoAcessoEm) : 'Nunca') },
  { header: 'Cliente desde', cell: (e) => dataCurta(e.createdAt) },
  {
    header: 'Situação',
    cell: (e) =>
      e.ativa ? (
        <Badge tone="ok" dot>
          Ativa
        </Badge>
      ) : (
        <Badge tone="neg" dot>
          Bloqueada
        </Badge>
      ),
  },
]

/** Lista das empresas clientes, com busca e cadastro de empresa nova. */
export function AdminEmpresasPage() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const empresas = useEmpresasAdmin(busca)
  const criar = useCriarEmpresa()
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [senha, setSenha] = useState<{ usuario: { nome: string; email: string }; senhaProvisoria: string } | null>(null)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nomeEmpresa.trim() || !form.nomeDono.trim() || !form.emailDono.trim()) {
      setErro('Preencha o nome da empresa, o nome e o email do dono.')
      return
    }
    setErro(null)
    try {
      const r = await criar.mutateAsync(form)
      setAberto(false)
      setForm(VAZIO)
      setSenha({ usuario: { nome: form.nomeDono.trim(), email: r.emailDono }, senhaProvisoria: r.senhaProvisoria })
    } catch (err) {
      setErro(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível criar a empresa.')
    }
  }

  const campo = (k: keyof EmpresaAdminCriarInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <PageHead
        title="Empresas clientes"
        sub={empresas.data ? `${empresas.data.length} empresa(s)` : undefined}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAberto(true)}>
            Nova empresa
          </Button>
        }
      />
      <div className="toolbar adm-toolbar">
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por nome, CNPJ ou email" label="Buscar empresas" />
      </div>
      {empresas.isError && (
        <p className="form-error" role="alert">
          Não foi possível carregar as empresas.
        </p>
      )}
      <DataTable
        columns={COLUNAS}
        rows={empresas.data}
        getKey={(e) => e.id}
        loading={empresas.isLoading}
        empty={{ title: busca ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada', icon: 'store' }}
        onRowClick={(e) => navigate(`/admin/empresas/${e.id}`)}
      />

      <Drawer open={aberto} onClose={() => setAberto(false)} title="Nova empresa" sub="O dono recebe uma senha provisória e troca no primeiro acesso.">
        <form className="form" onSubmit={salvar} noValidate>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Nome da empresa" value={form.nomeEmpresa} onChange={campo('nomeEmpresa')} maxLength={150} required />
          <TextField label="CNPJ ou CPF" value={form.documento} onChange={campo('documento')} maxLength={18} />
          <TextField label="Nome do dono" value={form.nomeDono} onChange={campo('nomeDono')} maxLength={120} required />
          <TextField label="Email do dono" type="email" value={form.emailDono} onChange={campo('emailDono')} maxLength={150} required />
          <div className="form-actions">
            <Button type="button" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar empresa'}
            </Button>
          </div>
        </form>
      </Drawer>

      <SenhaProvisoriaDialog dados={senha} onClose={() => setSenha(null)} />
    </>
  )
}
