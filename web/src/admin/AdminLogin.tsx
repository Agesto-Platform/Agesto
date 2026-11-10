import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, TextField } from '../components/ui'
import { Logo } from '../components/Logo'
import { ApiError } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { adminApi, adminLogado, clearAdminToken, setAdminToken } from './sessao'
import type { AdminAuthResponse } from './types'
import './admin.css'

const USING_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

/** Login da equipe do Agesto (área de superadmin). Não usa a conta de cliente. */
export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(USING_MOCKS ? 'equipe@agesto.app' : '')
  const [senha, setSenha] = useState(USING_MOCKS ? 'agesto-admin-123' : '')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  if (adminLogado()) return <Navigate to="/admin" replace />

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe email e senha.')
      return
    }
    setErro(null)
    setEntrando(true)
    try {
      clearAdminToken()
      const r = await adminApi.post<AdminAuthResponse>('/api/admin/auth/login', { email: email.trim(), senha })
      queryClient.removeQueries({ queryKey: ['admin'] })
      setAdminToken(r.token)
      navigate('/admin', { replace: true })
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card card" onSubmit={entrar} noValidate>
        <div className="adm-login-head">
          <Logo />
          <span className="badge future">Equipe Agesto</span>
        </div>
        <h1>Área de superadmin</h1>
        <p className="muted">Acesso restrito à equipe do Agesto. Toda ação aqui fica registrada.</p>
        <div className="form">
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" required />
          <TextField label="Senha" type="password" value={senha} onChange={setSenha} autoComplete="current-password" required />
        </div>
        <Button variant="primary" type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
