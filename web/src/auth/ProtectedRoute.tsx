import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Só deixa passar quem está autenticado; senão manda pro /login. Pendências do
 * primeiro acesso prendem a pessoa na tela delas, nesta ordem: aceite dos termos
 * (B6) e troca da senha provisória.
 * `raizPublica`: o que quem não está logado vê na raiz (a página de venda,
 * DEC-57); as outras rotas protegidas continuam mandando para o /login.
 */
export function ProtectedRoute({ raizPublica }: { raizPublica?: ReactNode } = {}) {
  const { isAuthenticated, deveTrocarSenha, termos } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    if (raizPublica && location.pathname === '/') return <>{raizPublica}</>
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (termos) {
    return location.pathname === '/aceitar-termos' ? <Outlet /> : <Navigate to="/aceitar-termos" replace />
  }
  if (location.pathname === '/aceitar-termos') {
    return <Navigate to="/" replace />
  }
  if (deveTrocarSenha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }
  return <Outlet />
}
