import { useAuth } from '../auth/useAuth'
import { useUsuarios } from '../features/usuarios/queries'

/**
 * Quem está logado, para a sidebar, o Agente e a saudação.
 * O token só traz e-mail e id; o nome vem da lista de usuários da empresa.
 * A API ainda não expõe o nome da empresa (Empresa.Nome existe no banco, sem
 * endpoint), então a conta mostra "Minha empresa" até esse dado chegar.
 */
export function useConta(): { nome: string; email: string; inicial: string; empresa: string | null } {
  const { user } = useAuth()
  const usuarios = useUsuarios()
  const email = user?.email ?? ''
  const eu = usuarios.data?.find((u) => String(u.id) === user?.sub)
  const nome = eu?.nome ?? (email ? email.split('@')[0]! : 'Minha conta')
  return { nome, email, inicial: (nome[0] ?? '?').toUpperCase(), empresa: null }
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio de quem usa. */
export function saudacao(d = new Date()): string {
  const h = d.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
