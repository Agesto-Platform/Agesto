import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { getDeveTrocarSenha } from '../lib/token'
import { Icon } from '../components/Icon'
import { Mascote, type MascoteApi } from '../components/Mascote'
import { guardarTransicao } from '../layout/entrada'
import './login.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USING_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type LocationState = { from?: string }

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/'

  const [email, setEmail] = useState(USING_MOCKS ? 'dono@agesto.app' : '')
  const [senha, setSenha] = useState(USING_MOCKS ? 'agesto123' : '')
  const [verSenha, setVerSenha] = useState(false)
  const [manter, setManter] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [socialNote, setSocialNote] = useState('')
  const [loading, setLoading] = useState(false)

  const liquidoRef = useRef<HTMLDivElement>(null)
  const mascote = useRef<MascoteApi | null>(null)
  const senhaRef = useRef<HTMLInputElement>(null)

  // fundo líquido com as cores da paleta ativa (mesmos parâmetros do componente original);
  // o three.js só baixa aqui, fora do pacote principal do painel
  useEffect(() => {
    const el = liquidoRef.current
    if (!el) return
    let parar: (() => void) | null = null
    let vivo = true
    void import('../components/liquido').then(({ startLiquido }) => {
      if (vivo) parar = startLiquido(el, { pixelSize: 18, resolution: 0.4, mouseForce: 8, cursorSize: 110, autoDemo: true })
    })
    return () => {
      vivo = false
      parar?.()
    }
  }, [])

  // o mascote se apresenta
  useEffect(() => {
    const t = window.setTimeout(
      () =>
        mascote.current?.say(
          <>
            Oi! Eu sou o <b>Agente</b> do Agesto.
          </>,
          3400,
        ),
      450,
    )
    return () => window.clearTimeout(t)
  }, [])

  const olharCampo = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    mascote.current?.lookAt(r.left + 70, r.top + r.height / 2)
  }

  // entrar: o mascote sorri e pula; o cartão vira o palco do painel (transição entre telas)
  function seguir() {
    const abrir = from === '/' && !getDeveTrocarSenha()
    const ir = () => navigate(from, { replace: true, state: abrir ? { entrada: true } : null })
    if (!abrir || reduced()) return ir()
    const root = document.documentElement
    root.classList.add('entrada')
    mascote.current?.face('happy').hop()
    window.setTimeout(() => {
      if (!document.startViewTransition) return ir()
      root.dataset.vt = 'entrada'
      const vt = document.startViewTransition(() => flushSync(ir))
      guardarTransicao(vt)
      vt.finished.finally(() => delete root.dataset.vt)
    }, 160)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setErro(null)
    if (!EMAIL_RE.test(email)) {
      setErro('Informe um e-mail válido.')
      mascote.current?.face('surprised', 650)
      return
    }
    if (senha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres.')
      mascote.current?.face('surprised', 650)
      return
    }
    setLoading(true)
    try {
      await login(email, senha)
      seguir()
    } catch (err) {
      setLoading(false)
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.')
      mascote.current?.face('surprised', 650)
    }
  }

  const social = (nome: string) => {
    setSocialNote(`Entrar com ${nome} ainda não existe no Agesto. Use e-mail e senha.`)
    mascote.current?.face('dot', 900)
  }

  return (
    <div className="login-page">
      <div className="liquido" ref={liquidoRef} aria-hidden="true" />
      <header className="login-top">
        <span className="logo">A</span>Agesto
      </header>
      <main className="login" id="page">
        <section className="login-card" aria-labelledby="ttl">
          <div className="login-mascot">
            <Mascote bubble ref={mascote} />
          </div>
          <h1 className="login-title fade-out" id="ttl">
            <span>Agesto</span>
            <span className="muted">O dinheiro que sobra, num lugar só.</span>
          </h1>

          <div className="fade-out">
            <div className="social">
              <button className="btn" type="button" onClick={() => social('Google')}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Google
              </button>
              <button className="btn" type="button" onClick={() => social('Apple')}>
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                  <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.72-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.59 1.1 8.75.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.29-.88-2.3-3.51zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.21z" />
                </svg>
                Apple
              </button>
            </div>
            <p className="social-note" aria-live="polite">
              {socialNote}
            </p>
            <div className="or">ou</div>
          </div>

          <form className="lform fade-out" onSubmit={handleSubmit} noValidate>
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
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    olharCampo(e.target)
                  }}
                  onFocus={(e) => {
                    olharCampo(e.target)
                    mascote.current?.face('dot', 450)
                  }}
                  onBlur={() => mascote.current?.free()}
                />
              </div>
            </div>
            <div className="lfield">
              <label htmlFor="senha">Senha</label>
              <div className="ibox pw">
                <span>
                  <Icon name="lock" />
                </span>
                <input
                  className="input"
                  id="senha"
                  ref={senhaRef}
                  type={verSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onFocus={() => mascote.current?.free().face('shy')}
                  onBlur={() => mascote.current?.face('idle')}
                />
                <button
                  className="eye"
                  type="button"
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={verSenha}
                  onClick={() => {
                    const mostrar = !verSenha
                    setVerSenha(mostrar)
                    if (mostrar) mascote.current?.face('surprised', 650)
                    else if (document.activeElement === senhaRef.current) mascote.current?.face('shy')
                  }}
                >
                  <Icon name={verSenha ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </div>
            <div className="lrow">
              <label className="check">
                <input type="checkbox" checked={manter} onChange={(e) => setManter(e.target.checked)} />
                Manter conectado
              </label>
              <a href="#" onClick={(e) => e.preventDefault()}>
                Esqueci a senha
              </a>
            </div>
            {erro && (
              <p className="login-error" role="alert">
                {erro}
              </p>
            )}
            <button
              className="btn primary go"
              type="submit"
              aria-busy={loading}
              onMouseEnter={() => mascote.current?.face('happy', 700)}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          {USING_MOCKS && <p className="legal fade-out">Ambiente de demonstração com dados de exemplo.</p>}
        </section>
      </main>
    </div>
  )
}
