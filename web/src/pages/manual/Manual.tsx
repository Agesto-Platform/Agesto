import { Logo } from '../../components/Logo'
import { AGENTE, ATUALIZADO_EM, DONO, type Secao } from './conteudo'
import '../login.css'
import './manual.css'

/** Manual de uso (KAN-42): o texto fica em conteudo.tsx. */
function Parte({ id, titulo, sub, secoes }: { id: string; titulo: string; sub: string; secoes: Secao[] }) {
  return (
    <section className="manual-parte" aria-labelledby={id}>
      <h2 className="manual-parte-titulo" id={id}>
        {titulo}
        <span className="muted">{sub}</span>
      </h2>
      {secoes.map((s) => (
        <section key={s.id} className="manual-secao" aria-labelledby={`${id}-${s.id}`}>
          <h3 className="passos-titulo" id={`${id}-${s.id}`}>
            {s.titulo}
          </h3>
          {s.conteudo}
        </section>
      ))}
    </section>
  )
}

function Indice({ id, titulo, secoes }: { id: string; titulo: string; secoes: Secao[] }) {
  return (
    <div>
      <a href={`#${id}`} className="manual-indice-parte">
        {titulo}
      </a>
      <ol>
        {secoes.map((s) => (
          <li key={s.id}>
            <a href={`#${id}-${s.id}`}>{s.titulo}</a>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Página pública /manual. */
export function Manual() {
  return (
    <div className="login-page manual-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <Logo />Agesto
      </header>
      <main className="login" id="page">
        <article className="login-card documento manual" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>Manual de uso</span>
            <span className="muted">Atualizado em {ATUALIZADO_EM}</span>
          </h1>

          <nav className="manual-indice" aria-label="Índice">
            <Indice id="dono" titulo="Para o dono (painel)" secoes={DONO} />
            <Indice id="agente" titulo="Para o agente (app)" secoes={AGENTE} />
          </nav>

          <Parte id="dono" titulo="Para o dono" sub="No painel do Agesto, pelo computador." secoes={DONO} />
          <Parte id="agente" titulo="Para o agente" sub="No app do Agesto, no celular Android." secoes={AGENTE} />

          <p className="legal manual-rodape">
            Ficou com dúvida? O dono abre um chamado na aba Suporte do painel; o agente fala com o dono da empresa.{' '}
            <button type="button" className="manual-imprimir" onClick={() => window.print()}>
              Imprimir ou salvar em PDF
            </button>
          </p>
        </article>
      </main>
    </div>
  )
}
