import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { queryClient } from '../lib/queryClient'
import { adminLogado, clearAdminToken } from './sessao'
import './admin.css'

/** Casco da área de superadmin: só entra com token de plataforma válido. */
export function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const admin = adminLogado()
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />

  const sair = () => {
    clearAdminToken()
    queryClient.removeQueries({ queryKey: ['admin'] })
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-brand">
          <Logo />
          <span className="badge future">Superadmin</span>
        </div>
        <nav className="adm-nav" aria-label="Área de superadmin">
          <NavLink to="/admin" end>
            Empresas
          </NavLink>
          <NavLink to="/admin/auditoria">Auditoria</NavLink>
          <NavLink to="/admin/equipe">Equipe</NavLink>
        </nav>
        <div className="adm-user">
          <span title={admin.email}>{admin.name ?? admin.email}</span>
          <Button size="sm" variant="ghost" icon="logout" onClick={sair}>
            Sair
          </Button>
        </div>
      </header>
      <main className="adm-main" id="page">
        <Outlet />
      </main>
    </div>
  )
}
