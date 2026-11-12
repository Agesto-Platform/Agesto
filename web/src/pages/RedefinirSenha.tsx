import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { SenhaField } from './SenhaField'
import './login.css'

/**
 * Lê o token do link do email. Ele vem depois do `#` (DEC-54): o navegador não
 * manda essa parte para o servidor, então o token não fica em logs nem no Referer.
 */
function tokenDoLink(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
}

/** Criar senha nova a partir do link de "Esqueci a senha" (DEC-54). */
export function RedefinirSenha() {
  const [token] = useState(tokenDoLink)
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pronto, setPronto] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.')
    setErro(null)
    setLoading(true)
    try {
      await api.post<null>('/api/auth/redefinir-senha', { token, novaSenha: nova })
      // Tira o token da barra de endereço e do histórico.
      window.history.replaceState(null, '', window.location.pathname)
      setPronto(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar a senha agora.')
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
            <span>{pronto ? 'Senha alterada' : 'Crie uma senha nova'}</span>
            <span className="muted">
              {pronto
                ? 'Agora é só entrar com a senha nova.'
                : token
                  ? 'Escolha a senha que vai usar daqui em diante.'
                  : 'Este link está incompleto. Abra de novo o link do e-mail.'}
            </span>
          </h1>

          {pronto ? (
            <div className="lform">
              <Link className="btn primary go" to="/login" replace>
                Ir para o login
              </Link>
            </div>
          ) : token ? (
            <form className="lform" onSubmit={handleSubmit} noValidate>
              <SenhaField
                id="senha-nova"
                label="Nova senha"
                value={nova}
                onChange={setNova}
                autoComplete="new-password"
                autoFocus
                hint="No mínimo 8 caracteres."
              />
              <SenhaField
                id="senha-confirma"
                label="Confirme a nova senha"
                value={confirma}
                onChange={setConfirma}
                autoComplete="new-password"
              />
              {erro && (
                <p className="login-error" role="alert">
                  {erro}
                </p>
              )}
              <button className="btn primary go" type="submit" aria-busy={loading}>
                {loading ? 'Salvando…' : 'Salvar senha nova'}
              </button>
            </form>
          ) : null}

          {!pronto && (
            <p className="legal">
              <Link className="btn ghost sm" to="/esqueci-senha">
                <Icon name="mail" />
                Pedir um link novo
              </Link>
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
