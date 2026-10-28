import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AppVersao } from '../types/api'
import './login.css'
import { Logo } from '../components/Logo'

type Estado = { tipo: 'carregando' } | { tipo: 'pronto'; url: string | null } | { tipo: 'erro' }

/**
 * Página pública de download do app do agente. Sem loja (DEC-47), o APK sai
 * deste link; ele vem de App__UrlDownload na API, então trocar o APK não
 * exige publicar o web.
 */
export function BaixarApp() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  useEffect(() => {
    let vivo = true
    api
      .get<AppVersao>('/api/app/versao')
      .then((v) => vivo && setEstado({ tipo: 'pronto', url: v.urlDownload }))
      .catch(() => vivo && setEstado({ tipo: 'erro' }))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <Logo />Agesto
      </header>
      <main className="login" id="page">
        <section className="login-card" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>Baixe o app do Agesto</span>
            <span className="muted">Para registrar os atendimentos no celular Android, mesmo sem internet.</span>
          </h1>

          {estado.tipo === 'pronto' && estado.url ? (
            <a className="btn primary go" href={estado.url}>
              Baixar o app (APK)
            </a>
          ) : (
            <p className="passos-nota" role="status">
              {estado.tipo === 'carregando'
                ? 'Carregando o link…'
                : estado.tipo === 'erro'
                  ? 'Não foi possível carregar o link agora. Tente de novo em alguns instantes.'
                  : 'O link do app ainda não está disponível. Fale com o responsável pela sua empresa.'}
            </p>
          )}

          <ol className="passos">
            <li>
              Abra esta página no celular Android e toque em <b>Baixar o app (APK)</b>.
            </li>
            <li>
              Se o Android pedir, permita que o navegador instale apps: <b>Configurações</b>, <b>Instalar apps
              desconhecidos</b>, escolha o navegador e ative <b>Permitir</b>.
            </li>
            <li>
              Abra o arquivo baixado e toque em <b>Instalar</b>. Se aparecer um aviso do Play Protect, toque em{' '}
              <b>Mais detalhes</b> e em <b>Instalar mesmo assim</b>.
            </li>
            <li>Abra o Agesto e entre com o email e a senha provisória que o responsável pela empresa enviou.</li>
          </ol>

          <h2 className="passos-titulo">Atualizações</h2>
          <p className="passos-nota">
            As correções chegam sozinhas. Quando o app mostrar <b>Versão nova do app</b>, sincronize, volte a esta
            página e instale o APK novo por cima do antigo. Os dados do aparelho continuam lá.
          </p>

          <p className="legal">Instale o Agesto só por esta página. Por enquanto, o app é só para Android.</p>
        </section>
      </main>
    </div>
  )
}
