import { useState, type FormEvent } from 'react'
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
  SelectField,
  TextField,
  useToast,
  type Column,
} from '../components/ui'
import { ApiError } from '../lib/api'
import { dataCurta, hora } from '../lib/format'
import type { PerfilUsuario } from '../types/api'
import { AuditoriaLista } from './AuditoriaLista'
import { AssinaturaAdminCard } from './AssinaturaAdminCard'
import {
  avisoDeEnvio,
  useAtivoUsuarioAdmin,
  useBloquearEmpresa,
  useCriarUsuarioAdmin,
  useDesbloquearEmpresa,
  useDefinirSenhaAdmin,
  useEmpresaAdmin,
  useEnviarLinkSenhaAdmin,
} from './queries'
import type { ConviteEnviado, UsuarioAdminCriarInput, UsuarioAdminItem } from './types'

type Pendente =
  | { tipo: 'desbloquear' }
  | { tipo: 'desativar' | 'reativar' | 'link'; usuario: UsuarioAdminItem }

const NOVO_ACESSO: UsuarioAdminCriarInput = { nome: '', email: '', perfil: 'Agente' }
const PERFIS: { value: PerfilUsuario; label: string }[] = [
  { value: 'Agente', label: 'Agente (usa o app em campo)' },
  { value: 'Dono', label: 'Dono (acessa o painel)' },
]

const quando = (iso: string | null) => (iso ? `${dataCurta(iso)} · ${hora(iso)}` : 'Nunca')

/** Detalhe de uma empresa cliente: situação, usuários e o que a equipe fez nela. */
export function AdminEmpresaPage() {
  const id = Number(useParams().id)
  const toast = useToast()
  const empresa = useEmpresaAdmin(id)
  const bloquear = useBloquearEmpresa(id)
  const desbloquear = useDesbloquearEmpresa(id)
  const ativo = useAtivoUsuarioAdmin(id)
  const link = useEnviarLinkSenhaAdmin(id)
  const definirSenha = useDefinirSenhaAdmin(id)
  const criarAcesso = useCriarUsuarioAdmin(id)
  // Agente cuja senha a equipe está definindo (DEC-59, KAN-32).
  const [senhaDe, setSenhaDe] = useState<UsuarioAdminItem | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)

  const [motivo, setMotivo] = useState('')
  const [bloqueando, setBloqueando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [novo, setNovo] = useState(NOVO_ACESSO)
  const [erroNovo, setErroNovo] = useState<string | null>(null)

  const falhou = (e: unknown, padrao: string) => toast.error(e instanceof ApiError ? e.message : padrao)
  const avisar = (r: ConviteEnviado, oQue: string) => {
    const aviso = avisoDeEnvio(r, oQue)
    if (aviso.ok) toast.success(aviso.texto)
    else toast.error(aviso.texto)
  }

  // Acesso novo (Dono ou Agente): a pessoa recebe o convite por email (DEC-55).
  const salvarNovo = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!novo.nome.trim() || !novo.email.trim()) {
      setErroNovo('Preencha o nome e o email.')
      return
    }
    const agente = novo.perfil === 'Agente'
    if (agente && (novo.senha ?? '').length < 8) {
      setErroNovo('A senha do agente precisa ter no mínimo 8 caracteres.')
      return
    }
    setErroNovo(null)
    try {
      const { senha, ...dados } = novo
      const r = await criarAcesso.mutateAsync({ ...dados, nome: novo.nome.trim(), email: novo.email.trim(), ...(agente ? { senha } : {}) })
      setNovoAberto(false)
      setNovo(NOVO_ACESSO)
      if (r.conviteEnviado === false) toast.success('Acesso criado. Passe a senha para o agente.')
      else avisar(r, 'Acesso criado. Convite enviado')
    } catch (err) {
      setErroNovo(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível criar o acesso.')
    }
  }

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

  const salvarSenha = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!senhaDe) return
    if (novaSenha.length < 8) {
      setErroSenha('A senha precisa ter no mínimo 8 caracteres.')
      return
    }
    setErroSenha(null)
    try {
      await definirSenha.mutateAsync({ usuarioId: senhaDe.id, novaSenha })
      toast.success(`Senha de ${senhaDe.nome} definida. Passe a nova senha para o agente.`)
      setSenhaDe(null)
      setNovaSenha('')
    } catch (err) {
      setErroSenha(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível definir a senha.')
    }
  }

  const confirmarPendente = async () => {
    if (!pendente) return
    try {
      if (pendente.tipo === 'desbloquear') {
        await desbloquear.mutateAsync()
        toast.success('Empresa desbloqueada.')
      } else if (pendente.tipo === 'link') {
        const r = await link.mutateAsync(pendente.usuario.id)
        avisar(r, pendente.usuario.convitePendente ? 'Convite reenviado' : 'Link de senha enviado')
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
        ) : u.bloqueadoAte && new Date(u.bloqueadoAte) > new Date() ? (
          <Badge tone="warn" dot>
            Bloqueado até {hora(u.bloqueadoAte)}
          </Badge>
        ) : u.convitePendente ? (
          <Badge tone="warn" dot>
            Convite pendente
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
          {u.ativo && u.perfil === 'Agente' && (
            <Button size="sm" icon="lock" onClick={() => { setSenhaDe(u); setNovaSenha(''); setErroSenha(null) }}>
              Definir senha
            </Button>
          )}
          {u.ativo && u.perfil !== 'Agente' && (
            <Button size="sm" icon="mail" onClick={() => setPendente({ tipo: 'link', usuario: u })}>
              {u.convitePendente ? 'Reenviar convite' : 'Enviar link de senha'}
            </Button>
          )}
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
    link:
      pendente?.tipo === 'link' && pendente.usuario.convitePendente
        ? {
            title: 'Reenviar o convite?',
            message: `${pendente.usuario.email} recebe um link novo, válido por 72 horas. O link anterior deixa de valer.`,
            label: 'Reenviar',
          }
        : {
            title: 'Enviar link de senha?',
            message: `${pendente?.tipo === 'link' ? pendente.usuario.email : 'A pessoa'} recebe um link, válido por 72 horas, para criar uma senha nova. A senha atual continua valendo até o link ser usado.`,
            label: 'Enviar',
          },
  }
  const texto = pendente ? textoConfirmacao[pendente.tipo] : null
  const ocupado = desbloquear.isPending || ativo.isPending || link.isPending

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
          {e.assinatura?.bloqueioAutomatico && ' (bloqueio automático: sai sozinho quando o pagamento for registrado)'}
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

      {e.assinatura && <AssinaturaAdminCard empresaId={e.id} assinatura={e.assinatura} />}

      <Card className="adm-bloco">
        <CardHead
          title="Usuários"
          subtitle="Acesso ao painel (Dono) e ao app (Agente). O Dono cria a senha pelo convite; a senha do Agente é definida aqui."
          action={
            <Button size="sm" icon="plus" onClick={() => setNovoAberto(true)}>
              Novo acesso
            </Button>
          }
        />
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

      <Drawer
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        title={`Novo acesso em ${e.nome}`}
        sub={
          novo.perfil === 'Agente'
            ? 'O agente entra no app com este email e a senha que você definir; o email não precisa existir (DEC-59).'
            : 'A pessoa recebe um convite por email para criar a própria senha (o link vale por 72 horas).'
        }
      >
        <form className="form" onSubmit={salvarNovo} noValidate>
          {erroNovo && (
            <p className="form-error" role="alert">
              {erroNovo}
            </p>
          )}
          <TextField label="Nome" value={novo.nome} onChange={(v) => setNovo((n) => ({ ...n, nome: v }))} maxLength={120} required />
          <TextField
            label={novo.perfil === 'Agente' ? 'Email (login no app)' : 'Email'}
            type={novo.perfil === 'Agente' ? 'text' : 'email'}
            value={novo.email}
            onChange={(v) => setNovo((n) => ({ ...n, email: v }))}
            maxLength={150}
            required
          />
          <SelectField<PerfilUsuario>
            label="Perfil"
            value={novo.perfil}
            onChange={(v) => setNovo((n) => ({ ...n, perfil: v }))}
            options={PERFIS}
            required
          />
          {novo.perfil === 'Agente' && (
            <TextField
              label="Senha"
              type="password"
              value={novo.senha ?? ''}
              onChange={(v) => setNovo((n) => ({ ...n, senha: v }))}
              hint="Mínimo de 8 caracteres. Passe a senha para o agente."
              maxLength={128}
              autoComplete="new-password"
              required
            />
          )}
          <div className="form-actions">
            <Button type="button" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={criarAcesso.isPending}>
              {criarAcesso.isPending ? 'Criando…' : novo.perfil === 'Agente' ? 'Criar acesso' : 'Criar e enviar convite'}
            </Button>
          </div>
        </form>
      </Drawer>

      <Drawer
        open={senhaDe !== null}
        onClose={() => setSenhaDe(null)}
        title={senhaDe ? `Definir a senha de ${senhaDe.nome}` : 'Definir senha'}
        sub="O agente passa a entrar com a senha nova. As sessões abertas no celular dele caem, e um bloqueio por senhas erradas sai."
      >
        <form className="form" onSubmit={salvarSenha} noValidate>
          {erroSenha && (
            <p className="form-error" role="alert">
              {erroSenha}
            </p>
          )}
          <TextField
            label="Nova senha"
            type="password"
            value={novaSenha}
            onChange={setNovaSenha}
            hint="Mínimo de 8 caracteres."
            maxLength={128}
            autoComplete="new-password"
            required
          />
          <div className="form-actions">
            <Button type="button" onClick={() => setSenhaDe(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={definirSenha.isPending}>
              {definirSenha.isPending ? 'Salvando…' : 'Definir senha'}
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  )
}
