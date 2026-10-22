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
