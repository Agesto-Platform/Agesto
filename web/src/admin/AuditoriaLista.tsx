import { Link } from 'react-router-dom'
import { DataTable, PageHead, type Column } from '../components/ui'
import { dataCurta, hora } from '../lib/format'
import { useAuditoriaAdmin } from './queries'
import type { AuditoriaAdminItem } from './types'

const ACAO: Record<string, string> = {
  login: 'Entrou na área de superadmin',
  'login-falhou': 'Tentativa de login recusada',
  'desativar-admin': 'Desativou administrador',
  'reativar-admin': 'Reativou administrador',
  setup: 'Criou o primeiro administrador',
  'criar-admin': 'Cadastrou administrador',
  'criar-empresa': 'Cadastrou empresa',
  'bloquear-empresa': 'Bloqueou empresa',
  'desbloquear-empresa': 'Desbloqueou empresa',
  'desativar-usuario': 'Desativou usuário',
  'reativar-usuario': 'Reativou usuário',
  // Registros antigos, de antes do convite por email (DEC-55).
  'redefinir-senha': 'Gerou senha provisória',
  'convidar-admin': 'Convidou administrador',
  'reenviar-convite-admin': 'Reenviou convite de administrador',
  'criar-senha': 'Criou a senha pelo convite',
  'criar-usuario': 'Criou acesso e enviou convite',
  'reenviar-convite': 'Reenviou convite',
  'enviar-link-senha': 'Enviou link de senha',
}

/** Registro das ações da equipe (todas, ou só as de uma empresa). */
export function AuditoriaLista({ empresaId }: { empresaId?: number }) {
  const auditoria = useAuditoriaAdmin(empresaId)

  const colunas: Column<AuditoriaAdminItem>[] = [
    { header: 'Quando', cell: (a) => `${dataCurta(a.createdAt)} · ${hora(a.createdAt)}` },
    { header: 'Quem', cell: (a) => a.adminNome },
    { header: 'Ação', cell: (a) => ACAO[a.acao] ?? a.acao },
    ...(empresaId
      ? []
      : [
          {
            header: 'Empresa',
            cell: (a: AuditoriaAdminItem) =>
              a.empresaId ? <Link to={`/admin/empresas/${a.empresaId}`}>{a.empresaNome ?? `#${a.empresaId}`}</Link> : '—',
          },
        ]),
    { header: 'Detalhes', cell: (a) => a.detalhes ?? '' },
  ]

  return (
    <DataTable
      columns={colunas}
      rows={auditoria.data}
      getKey={(a) => a.id}
      loading={auditoria.isLoading}
      empty={{ title: 'Nenhuma ação registrada', icon: 'archive' }}
    />
  )
}

export function AdminAuditoriaPage() {
  return (
    <>
      <PageHead title="Auditoria" sub="As 200 ações mais recentes da equipe do Agesto, em todas as empresas." />
      <AuditoriaLista />
    </>
  )
}
