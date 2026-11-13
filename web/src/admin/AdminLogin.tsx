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

/**
 * Login da equipe do Agesto (área de superadmin). Não usa a conta de cliente.
 * Duas etapas (DEC-52): a senha e, depois, o código de 6 dígitos enviado por email.
 */
export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(USING_MOCKS ? 'equipe@agesto.app' : '')
  const [senha, setSenha] = useState(USING_MOCKS ? 'agesto-admin-123' : '')
  const [codigo, setCodigo] = useState('')
  const [desafio, setDesafio] = useState<{ token: string; email: string | null } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (adminLogado()) return <Navigate to="/admin" replace />

  const concluir = (r: AdminAuthResponse) => {
    queryClient.removeQueries({ queryKey: ['admin'] })
    setAdminToken(r.token)
    navigate('/admin', { replace: true })
  }

  const pedirCodigo = async () => {
    clearAdminToken()
    const r = await adminApi.post<AdminAuthResponse>('/api/admin/auth/login', { email: email.trim(), senha })
    if (r.exigeCodigo && r.desafio) {
      setDesafio({ token: r.desafio, email: r.emailMascarado ?? null })
      setCodigo('')
      return
    }
    concluir(r)
  }

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !senha) {
      setErro('Informe email e senha.')
      return
    }
    setErro(null)
    setAviso(null)
    setEnviando(true)
    try {
      await pedirCodigo()
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  const confirmar = async (e: FormEvent) => {
    e.preventDefault()
    if (!desafio) return
    const digitos = codigo.replace(/\D/g, '')
    if (digitos.length !== 6) {
      setErro('Digite os 6 números do código.')
      return
    }
    setErro(null)
    setAviso(null)
    setEnviando(true)
    try {
      const r = await adminApi.post<AdminAuthResponse>('/api/admin/auth/login/codigo', { desafio: desafio.token, codigo: digitos })
      concluir(r)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível confirmar o código. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  // Novo código: refaz a primeira etapa (o código anterior deixa de valer).
  const reenviar = async () => {
    setErro(null)
    setAviso(null)
    setEnviando(true)
    try {
      await pedirCodigo()
      setAviso('Enviamos um código novo. O anterior não vale mais.')
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível reenviar o código.')
    } finally {
      setEnviando(false)
    }
  }

  const voltar = () => {
    setDesafio(null)
    setCodigo('')
    setErro(null)
    setAviso(null)
  }

  return (
    <div className="adm-login">
      {desafio ? (
        <form className="adm-login-card card" onSubmit={confirmar} noValidate>
          <div className="adm-login-head">
            <Logo />
            <span className="badge future">Equipe Agesto</span>
          </div>
          <h1>Confirme que é você</h1>
          <p className="muted">
            Enviamos um código de 6 números para {desafio.email ?? 'o seu email'}. Ele vale por 10 minutos.
          </p>
          <div className="form">
            {erro && (
              <p className="form-error" role="alert">
                {erro}
              </p>
            )}
            {aviso && <p className="muted" role="status">{aviso}</p>}
            <TextField
              label="Código"
              value={codigo}
              onChange={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
          <Button variant="primary" type="submit" disabled={enviando}>
            {enviando ? 'Confirmando…' : 'Entrar'}
          </Button>
          <div className="adm-login-acoes">
            <Button variant="ghost" type="button" onClick={() => void reenviar()} disabled={enviando}>
              Reenviar código
            </Button>
            <Button variant="ghost" type="button" onClick={voltar} disabled={enviando}>
              Voltar
            </Button>
          </div>
        </form>
      ) : (
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
          <Button variant="primary" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      )}
    </div>
  )
}
