import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  ConfirmDialog,
  DataTable,
  Drawer,
  PageHead,
  TextField,
  useToast,
  type Column,
} from '../components/ui'
import { SenhaProvisoriaDialog } from '../features/usuarios/SenhaProvisoriaDialog'
import { ApiError } from '../lib/api'
import { dataCurta, hora } from '../lib/format'
import { AuditoriaLista } from './AuditoriaLista'
import {
  useAtivoUsuarioAdmin,
  useBloquearEmpresa,
  useDesbloquearEmpresa,
  useEmpresaAdmin,
  useSenhaProvisoriaAdmin,
} from './queries'
import type { UsuarioAdminItem } from './types'

type Pendente =
  | { tipo: 'desbloquear' }
  | { tipo: 'desativar' | 'reativar' | 'senha'; usuario: UsuarioAdminItem }

const quando = (iso: string | null) => (iso ? `${dataCurta(iso)} · ${hora(iso)}` : 'Nunca')

/** Detalhe de uma empresa cliente: situação, usuários e o que a equipe fez nela. */
export function AdminEmpresaPage() {
  const id = Number(useParams().id)
  const toast = useToast()
  const empresa = useEmpresaAdmin(id)
  const bloquear = useBloquearEmpresa(id)
  const desbloquear = useDesbloquearEmpresa(id)
  const ativo = useAtivoUsuarioAdmin(id)
  const senha = useSenhaProvisoriaAdmin(id)

  const [motivo, setMotivo] = useState('')
  const [bloqueando, setBloqueando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ usuario: { nome: string; email: string }; senhaProvisoria: string } | null>(null)

  const falhou = (e: unknown, padrao: string) => toast.error(e instanceof ApiError ? e.message : padrao)

  const confirmarBloqueio = async () => {
    if (motivo.trim().length < 3) {
      setErro('Escreva o motivo do bloqueio (fica registrado na auditoria).')
      return
    }
    try {
      await bloquear.mutateAsync(motivo.trim())
      setBloqueando(false)
      setMotivo('')
      toast.success('Empresa bloqueada. Ninguém dela consegue entrar até o desbloqueio.')
    } catch (e) {
      falhou(e, 'Não foi possível bloquear a empresa.')
    }
  }

  const confirmarPendente = async () => {
    if (!pendente) return
    try {
      if (pendente.tipo === 'desbloquear') {
        await desbloquear.mutateAsync()
        toast.success('Empresa desbloqueada.')
      } else if (pendente.tipo === 'senha') {
        const r = await senha.mutateAsync(pendente.usuario.id)
        setSenhaGerada({ usuario: { nome: pendente.usuario.nome, email: r.email }, senhaProvisoria: r.senhaProvisoria })
      } else {
        await ativo.mutateAsync({ usuarioId: pendente.usuario.id, ativo: pendente.tipo === 'reativar' })
        toast.success(pendente.tipo === 'reativar' ? 'Usuário reativado.' : 'Usuário desativado.')
      }
      setPendente(null)
    } catch (e) {
      falhou(e, 'Não foi possível concluir a ação.')
    }
  }

  if (empresa.isLoading) return <p className="muted">Carregando…</p>
  if (empresa.isError || !empresa.data)
    return (
      <p className="form-error" role="alert">
        Empresa não encontrada. <Link to="/admin">Voltar para a lista</Link>
      </p>
    )

  const e = empresa.data

  const colunas: Column<UsuarioAdminItem>[] = [
    {
      header: 'Usuário',
      cell: (u) => (
        <div className="adm-cell">
          <b>{u.nome}</b>
          <span>{u.email}</span>
        </div>
      ),
    },
    { header: 'Perfil', cell: (u) => u.perfil },
    { header: 'Último acesso', cell: (u) => quando(u.ultimoAcessoEm) },
    {
      header: 'Situação',
      cell: (u) =>
        !u.ativo ? (
          <Badge tone="neg" dot>
            Desativado
          </Badge>
        ) : u.deveTrocarSenha ? (
          <Badge tone="warn" dot>
            Aguardando 1º acesso
          </Badge>
        ) : (
          <Badge tone="ok" dot>
            Ativo
          </Badge>
        ),
    },
    {
      header: '',
      align: 'right',
      cell: (u) => (
        <div className="adm-acoes">
          <Button size="sm" onClick={() => setPendente({ tipo: 'senha', usuario: u })}>
            Senha provisória
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPendente({ tipo: u.ativo ? 'desativar' : 'reativar', usuario: u })}>
            {u.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        </div>
      ),
    },
  ]

  const textoConfirmacao: Record<Pendente['tipo'], { title: string; message: string; label: string }> = {
    desbloquear: {
      title: `Desbloquear ${e.nome}?`,
      message: 'Os usuários ativos da empresa voltam a entrar no painel e no app.',
      label: 'Desbloquear',
    },
    desativar: {
      title: 'Desativar usuário?',
      message: 'A pessoa perde o acesso na hora, no painel e no app.',
      label: 'Desativar',
    },
    reativar: { title: 'Reativar usuário?', message: 'A pessoa volta a entrar com a senha atual.', label: 'Reativar' },
    senha: {
      title: 'Gerar senha provisória?',
      message: 'A senha atual deixa de valer. A pessoa troca a provisória no próximo acesso.',
      label: 'Gerar senha',
    },
  }
  const texto = pendente ? textoConfirmacao[pendente.tipo] : null
  const ocupado = desbloquear.isPending || ativo.isPending || senha.isPending

  return (
    <>
      <p className="adm-voltar">
        <Link to="/admin">← Empresas</Link>
      </p>
      <PageHead
        title={e.nome}
        sub={[e.documento, `cliente desde ${dataCurta(e.createdAt)}`].filter(Boolean).join(' · ')}
        badge={
          e.ativa ? (
            <Badge tone="ok" dot>
              Ativa
            </Badge>
          ) : (
            <Badge tone="neg" dot>
              Bloqueada
            </Badge>
          )
        }
        actions={
          e.ativa ? (
            <Button icon="lock" onClick={() => setBloqueando(true)}>
              Bloquear empresa
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setPendente({ tipo: 'desbloquear' })}>
              Desbloquear
            </Button>
          )
        }
      />

      {!e.ativa && (
        <p className="adm-alerta" role="status">
          Bloqueada em {quando(e.bloqueadaEm)}. Motivo: {e.motivoBloqueio}
        </p>
      )}

      <div className="adm-stats">
        <div className="card">
          <span>Usuários</span>
          <b>{e.usuarios.length}</b>
        </div>
        <div className="card">
          <span>Clientes cadastrados</span>
          <b>{e.totalClientes}</b>
        </div>
        <div className="card">
          <span>Atendimentos</span>
          <b>{e.totalAtendimentos}</b>
        </div>
        <div className="card">
          <span>Último acesso</span>
          <b>{e.ultimoAcessoEm ? dataCurta(e.ultimoAcessoEm) : 'Nunca'}</b>
        </div>
      </div>

      <Card className="adm-bloco">
        <CardHead title="Usuários" subtitle="Acesso ao painel (Dono) e ao app (Agente)." />
        <CardBody>
          <DataTable columns={colunas} rows={e.usuarios} getKey={(u) => u.id} empty={{ title: 'Nenhum usuário' }} />
        </CardBody>
      </Card>

      <Card className="adm-bloco">
        <CardHead title="Histórico da equipe nesta empresa" />
        <CardBody>
          <AuditoriaLista empresaId={e.id} />
        </CardBody>
      </Card>

      <Drawer open={bloqueando} onClose={() => setBloqueando(false)} title={`Bloquear ${e.nome}`} sub="Todos os usuários perdem o acesso na hora, no painel e no app.">
        <div className="form">
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Motivo" value={motivo} onChange={setMotivo} maxLength={300} placeholder="Ex.: mensalidade atrasada" required />
          <div className="form-actions">
            <Button type="button" onClick={() => setBloqueando(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmarBloqueio} disabled={bloquear.isPending}>
              {bloquear.isPending ? 'Bloqueando…' : 'Bloquear'}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendente !== null}
        title={texto?.title ?? ''}
        message={texto?.message ?? ''}
        confirmLabel={texto?.label}
        loading={ocupado}
        onConfirm={confirmarPendente}
        onCancel={() => setPendente(null)}
      />
      <SenhaProvisoriaDialog dados={senhaGerada} onClose={() => setSenhaGerada(null)} />
    </>
  )
}
