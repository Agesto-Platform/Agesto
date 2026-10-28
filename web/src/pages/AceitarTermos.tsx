import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'
import { ApiError } from '../lib/api'
import './login.css'
import { Logo } from '../components/Logo'

/** Aceite dos termos de uso e da política de privacidade (B6), antes de usar o painel. Mesmo cartão do login. */
export function AceitarTermos() {
  const { termos, aceitarTermos, logout } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function aceitar() {
    if (loading) return
    setErro(null)
    setLoading(true)
    try {
      await aceitarTermos()
      // a guarda de rota leva para a próxima pendência (troca de senha), se houver
      navigate('/', { replace: true })
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível registrar o aceite. Tente novamente.')
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
            <span>Termos de uso e privacidade</span>
            <span className="muted">Para usar o Agesto, leia e aceite os documentos abaixo.</span>
          </h1>

          <p className="passos-nota">
            Eles explicam como o Agesto funciona e como tratamos os seus dados e os dos seus clientes.
          </p>
          <ul className="termos-docs">
            <Documento titulo="Termos de uso" url={termos?.urlTermos ?? null} />
            <Documento titulo="Política de privacidade" url={termos?.urlPrivacidade ?? null} />
          </ul>
          {termos && <p className="termos-versao">Versão {termos.versao}</p>}

          {erro && (
            <p className="login-error" role="alert">
              {erro}
            </p>
          )}
          <button className="btn primary go" type="button" onClick={aceitar} aria-busy={loading}>
            {loading ? 'Registrando…' : 'Li e aceito'}
          </button>

          <p className="legal">
            <button className="btn ghost sm" type="button" onClick={logout}>
              <Icon name="logout" />
              Sair
            </button>
          </p>
        </section>
      </main>
    </div>
  )
}

function Documento({ titulo, url }: { titulo: string; url: string | null }) {
  return (
    <li>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="file" />
          {titulo}
          <span className="sr-only"> (abre em outra aba)</span>
        </a>
      ) : (
        <span>
          <Icon name="file" />
          {titulo}
        </span>
      )}
    </li>
  )
}
