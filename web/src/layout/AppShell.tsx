import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { AgentPanel } from './AgentPanel'
import { Mascote, type MascoteApi } from '../components/Mascote'
import { pegarTransicao, posicionarOverlay, runEntrada, entradaReduzida } from './entrada'
import { saudacao, useConta } from './useConta'
import type { Period } from './PeriodSwitch'

/**
 * Contexto exposto às telas via <Outlet>: o período (7 dias / Mês / Ano) e,
 * na Visão geral, o aviso de que os cards já estão na tela para a abertura.
 */
export type ShellContext = {
  period: Period
  setPeriod: (p: Period) => void
  entradaPronta: () => void
}

/** Telas largas (calendário, relatórios) abrem com o Agente fechado, como nos templates. */
const SEM_AGENTE = ['/agenda', '/relatorios']

const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const largo = () => window.matchMedia('(min-width: 1280px)').matches

export function AppShell() {
  const [period, setPeriod] = useState<Period>('mes')
  const location = useLocation()
  const agentePadrao = () => largo() && !SEM_AGENTE.includes(location.pathname)
  const [agentOpen, setAgentOpen] = useState(agentePadrao)
  const [navOpen, setNavOpen] = useState(false)
  const conta = useConta()

  // cada tela abre com o Agente no estado dela (como cada página do template)
  const [rota, setRota] = useState(location.pathname)
  if (rota !== location.pathname) {
    setRota(location.pathname)
    setAgentOpen(agentePadrao())
  }
  const navigate = useNavigate()

  // abertura pós-login: chega com state { entrada: true } vindo do Login
  const [entrada, setEntrada] = useState(() => (location.state as { entrada?: boolean } | null)?.entrada === true)
  const overlayRef = useRef<HTMLDivElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)
  const mascoteRef = useRef<MascoteApi | null>(null)
  const painelRef = useRef<MascoteApi | null>(null)
  const vtRef = useRef<ViewTransition | null>(null)
  const iniciou = useRef(false)

  // no primeiro quadro: mascote no centro com o nome da transição, para o do login pousar nele
  useLayoutEffect(() => {
    if (!entrada || !overlayRef.current) return
    vtRef.current = pegarTransicao()
    if (vtRef.current && orbRef.current) orbRef.current.style.viewTransitionName = 'agente'
    posicionarOverlay(overlayRef.current)
    // recarregar não repete a abertura
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const entradaPronta = useCallback(() => {
    if (!entrada || iniciou.current || !overlayRef.current) return
    iniciou.current = true
    if (entradaReduzida()) {
      document.documentElement.classList.remove('entrada')
      document.querySelector('#page')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
      setEntrada(false)
      return
    }
    runEntrada({
      vt: vtRef.current,
      overlay: overlayRef.current,
      mascote: mascoteRef.current,
      painelMascote: () => painelRef.current,
      onDone: () => setEntrada(false),
    })
  }, [entrada])

  // a abertura nunca prende a tela: se a Visão geral não avisar, solta em 4s
  useEffect(() => {
    if (!entrada) return
    const t = window.setTimeout(() => {
      if (iniciou.current) return
      document.documentElement.classList.remove('entrada')
      setEntrada(false)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [entrada])

  // trocar de tela fecha o menu do celular
  useEffect(() => setNavOpen(false), [location.pathname])

  // abaixo de 1280px o Agente vira sobreposição: ao estreitar a janela, ele fecha
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = () => !mq.matches && setAgentOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Esc fecha o menu do celular
  useEffect(() => {
    if (!navOpen) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [navOpen])

  const fecharNav = useCallback(() => setNavOpen(false), [])

  return (
    <div className="app">
      <div className="shell" data-agent={agentOpen ? 'open' : 'closed'} data-nav={navOpen ? 'open' : 'closed'}>
        <Sidebar onNavigate={fecharNav} />
        <div className="nav-scrim" onClick={fecharNav} />
        <div className="stage">
          <div className="main">
            <Topbar agentOpen={agentOpen} onToggleAgent={() => setAgentOpen((v) => !v)} onOpenNav={() => setNavOpen(true)} />
            <div className="page">
              <div id="page">
                <Outlet context={{ period, setPeriod, entradaPronta } satisfies ShellContext} />
              </div>
            </div>
          </div>
          <AgentPanel onClose={() => setAgentOpen(false)} onMascote={(api) => (painelRef.current = api)} />
        </div>
      </div>

      {entrada && (
        <div className="entrada-orb" aria-hidden="true" ref={overlayRef} style={{ visibility: 'hidden' }}>
          <div className="entrada-fly">
            <span className="ring" />
            <div className="orb mascot" ref={orbRef}>
              <Mascote ref={mascoteRef} />
            </div>
          </div>
          <div className="entrada-txt">
            <b>
              {saudacao()}, {conta.nome}
            </b>
            <span>Seus números de {MES[new Date().getMonth()]}</span>
          </div>
          <div className="entrada-skip">Clique ou aperte uma tecla para pular</div>
        </div>
      )}
    </div>
  )
}
