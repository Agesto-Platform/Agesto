import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { PRIVACIDADE, TERMOS, type DocumentoLegal } from './textos'
import '../login.css'

/** Página pública de um texto legal: o app e o web abrem pelo link da tela de aceite. */
export function Documento({ doc, outro }: { doc: DocumentoLegal; outro: { to: string; label: string } }) {
  const publicado = doc.secoes.length > 0

  return (
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <Logo />Agesto
      </header>
      <main className="login" id="page">
        <article className="login-card documento" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>{doc.titulo}</span>
            {publicado && doc.atualizadoEm && <span className="muted">Atualizado em {doc.atualizadoEm}</span>}
          </h1>

          {publicado ? (
            doc.secoes.map((s) => (
              <section key={s.titulo}>
                <h2 className="passos-titulo">{s.titulo}</h2>
                {s.paragrafos.map((p, i) => (
                  <p key={i} className="passos-nota">
                    {p}
                  </p>
                ))}
              </section>
            ))
          ) : (
            <p className="passos-nota" role="status">
              Este texto está em revisão e será publicado aqui antes de o Agesto pedir o seu aceite. Em caso de
              dúvida, fale com o responsável pela sua empresa.
            </p>
          )}

          <p className="legal">
            <Link to={outro.to}>{outro.label}</Link>
          </p>
        </article>
      </main>
    </div>
  )
}

export function Termos() {
  return <Documento doc={TERMOS} outro={{ to: '/privacidade', label: 'Política de privacidade' }} />
}

export function Privacidade() {
  return <Documento doc={PRIVACIDADE} outro={{ to: '/termos', label: 'Termos de uso' }} />
}
