import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Só deixa passar quem está autenticado; senão manda pro /login. Quem entrou
 * com senha provisória fica preso na troca de senha até concluir.
 */
export function ProtectedRoute() {
  const { isAuthenticated, deveTrocarSenha } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (deveTrocarSenha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />
  }
  return <Outlet />
}
