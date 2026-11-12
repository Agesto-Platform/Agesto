import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { api, ApiError } from '../lib/api'
import './login.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * "Esqueci a senha" do Dono (DEC-54): pede o link por email. A resposta é sempre
 * a mesma, exista o email ou não, então a tela também não diz se a conta existe.
 */
export function EsqueciSenha() {
  const inicial = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    const valor = email.trim()
    if (!EMAIL_RE.test(valor)) return setErro('Digite um e-mail válido.')
    setErro(null)
    setLoading(true)
    try {
      await api.post<null>('/api/auth/esqueci-senha', { email: valor })
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível enviar agora. Tente de novo em instantes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <Logo />Agesto
      </header>
      <main className="login" id="page">
        <section className="login-card" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>Esqueci a senha</span>
            <span className="muted">
              {enviado
                ? 'Pronto. Confira a sua caixa de entrada.'
                : 'Digite o e-mail do seu acesso. Enviamos um link para criar uma senha nova.'}
            </span>
          </h1>

          {enviado ? (
            <div className="lform" role="status">
              <p style={{ margin: 0 }}>
                Se <b>{email.trim()}</b> tiver acesso ao Agesto, o link chega em alguns minutos. Ele vale por 15
                minutos e funciona uma vez só. Confira também o spam.
              </p>
            </div>
          ) : (
            <form className="lform" onSubmit={handleSubmit} noValidate>
              <div className="lfield">
                <label htmlFor="email">E-mail</label>
                <div className="ibox">
                  <span>
                    <Icon name="mail" />
                  </span>
                  <input
                    className="input"
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="voce@empresa.com.br"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              {erro && (
                <p className="login-error" role="alert">
                  {erro}
                </p>
              )}
              <button className="btn primary go" type="submit" aria-busy={loading}>
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}

          <p className="legal">
            <Link className="btn ghost sm" to="/login">
              <Icon name="left" />
              Voltar para o login
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}
