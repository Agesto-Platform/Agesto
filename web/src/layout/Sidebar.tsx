import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { navVisivel, type NavItem } from './nav'
import { useConta } from './useConta'
import { useAuth } from '../auth/useAuth'
import { useConfiguracao } from '../features/parametrizacao/queries'
import { Icon, PanelIcon } from '../components/Icon'
import { PALETTES, setPalette, useTheme } from '../theme/theme'
import { Logo } from '../components/Logo'

const SB_KEY = 'agesto-sb'
const GRUPOS_KEY = 'agesto-sb-grupos'
const GRUPOS_PADRAO: Record<string, boolean> = { Operação: true, Cadastros: true, Análise: false, Sistema: true }
const MODO = { Servico: 'Serviço', Venda: 'Venda', Hibrido: 'Híbrido' } as const

const desktop = () => window.matchMedia('(min-width: 1024px)').matches
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function lerGrupos(): Record<string, boolean> {
  try {
    return { ...GRUPOS_PADRAO, ...(JSON.parse(localStorage.getItem(GRUPOS_KEY) ?? '{}') as Record<string, boolean>) }
  } catch {
    return GRUPOS_PADRAO
  }
}

function salvar(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* sem armazenamento */
  }
}

/** Recolhida/aberta vive no <html data-sb> (o CSS anima a largura); só no desktop. */
function useRecolhida(): [boolean, () => void] {
  const [recolhida, setRecolhida] = useState(() => document.documentElement.dataset.sb === 'collapsed')

  useEffect(() => {
    const aplicar = () => {
      let salvo = 'open'
      try {
        salvo = localStorage.getItem(SB_KEY) ?? 'open'
      } catch {
        /* */
      }
      const estado = desktop() ? salvo : 'open'
      document.documentElement.dataset.sb = estado
      setRecolhida(estado === 'collapsed')
    }
    window.addEventListener('resize', aplicar)
    return () => window.removeEventListener('resize', aplicar)
  }, [])

  const alternar = useCallback(() => {
    const root = document.documentElement
    const novo = root.dataset.sb === 'collapsed' ? 'open' : 'collapsed'
    salvar(SB_KEY, novo)
    if (!reduced()) {
      root.classList.add('sb-anim')
      window.setTimeout(() => root.classList.remove('sb-anim'), 420)
    }
    root.dataset.sb = novo
    setRecolhida(novo === 'collapsed')
  }, [])

  return [recolhida, alternar]
}

/** Dica com o nome do item quando a sidebar está recolhida. */
function useDica(recolhida: boolean) {
  const [dica, setDica] = useState<{ text: string; left: number; top: number } | null>(null)
  const mostrar = (el: HTMLElement | null) => {
    if (!recolhida || !el?.dataset.tip) return
    const r = el.getBoundingClientRect()
    setDica({ text: el.dataset.tip, left: r.right + 12, top: r.top + r.height / 2 - 13 })
  }
  const esconder = () => setDica(null)
  return { dica: recolhida ? dica : null, mostrar, esconder }
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { logout } = useAuth()
  const conta = useConta()
  const config = useConfiguracao()
  const tipo = config.data?.tipoOperacao
  const nav = navVisivel(tipo)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { palette } = useTheme()

  const [recolhida, alternar] = useRecolhida()
  const [grupos, setGrupos] = useState(lerGrupos)
  const [menuAberto, setMenuAberto] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { dica, mostrar, esconder } = useDica(recolhida)

  const alternarGrupo = (label: string) => {
    setGrupos((g) => {
      const novo = { ...g, [label]: !(g[label] !== false) }
      salvar(GRUPOS_KEY, JSON.stringify(novo))
      return novo
    })
  }

  // menu da conta: fecha no clique fora e no Esc
  useEffect(() => {
    if (!menuAberto) return
    const fora = (e: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuAberto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false)
    document.addEventListener('click', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [menuAberto])

  const sair = () => {
    setMenuAberto(false)
    logout()
    navigate('/login', { replace: true })
  }

  const item = (i: NavItem) => (
    <NavLink
      key={i.to}
      to={i.to}
      end={i.to === '/'}
      viewTransition
      className="sb-item"
      data-tip={i.label}
      onClick={onNavigate}
    >
      <Icon name={i.icon} />
      <span className="sb-label">{i.label}</span>
      {i.to === '/parametrizacao' && tipo && <span className="badge brand">{MODO[tipo]}</span>}
    </NavLink>
  )

  const inicio = nav.flatMap((g) => g.items).find((i) => i.to === '/')
  const empresa = conta.empresa ?? 'Minha empresa'

  return (
    <aside
      className="sidebar"
      aria-label="Navegação"
      onMouseOver={(e: MouseEvent<HTMLElement>) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
        if (el && !menuAberto) mostrar(el)
      }}
      onMouseOut={(e: MouseEvent<HTMLElement>) => {
        const to = e.relatedTarget as HTMLElement | null
        if (!to?.closest?.('[data-tip]')) esconder()
      }}
      onFocus={(e: FocusEvent<HTMLElement>) => mostrar((e.target as HTMLElement).closest<HTMLElement>('[data-tip]'))}
      onBlur={esconder}
    >
      <div className="sb-top">
        <NavLink className="sb-brand" to="/" viewTransition onClick={onNavigate}>
          <Logo />
          <span className="sb-label">Agesto</span>
        </NavLink>
        <button
          className="icon-btn sb-toggle"
          type="button"
          onClick={() => {
            setMenuAberto(false)
            alternar()
          }}
          aria-label={recolhida ? 'Abrir menu' : 'Recolher menu'}
          aria-expanded={!recolhida}
        >
          <PanelIcon mirror />
        </button>
      </div>

      <nav className="sb-nav">
        {inicio && item(inicio)}
        {nav.map((g) => {
          const itens = g.items.filter((i) => i.to !== '/')
          if (!itens.length) return null
          const open = grupos[g.label] !== false || itens.some((i) => i.to === pathname)
          return (
            <div className="sb-group" data-open={open} key={g.label}>
              <button className="sb-group-head" type="button" aria-expanded={open} onClick={() => alternarGrupo(g.label)}>
                <Icon name="right" />
                <span className="sb-label">{g.label}</span>
              </button>
              <div className="sb-group-body">
                <div className="sb-group-inner">{itens.map(item)}</div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* conta: empresa + pessoa num botão só; trocar empresa, aparência, ajuda e sair ficam no menu */}
      <div className="sb-foot">
        <div className={`sb-unit-wrap${menuAberto ? ' open' : ''}`} ref={wrapRef}>
          <button
            className="sb-unit"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            aria-label={`Conta: ${empresa}, ${conta.nome}`}
            data-tip={`${empresa} · ${conta.nome}`}
            onClick={() => {
              esconder()
              setMenuAberto((v) => !v)
            }}
          >
            <span className="sb-acc-av">
              <span className="sb-unit-av">
                <Icon name="store" />
              </span>
              <span className="avatar">{conta.inicial}</span>
            </span>
            <span className="sb-label">
              <b>{empresa}</b>
              <span>{conta.nome} · Dono</span>
            </span>
            <Icon name="down" className="chev" />
          </button>

          <div className="sb-menu" role="menu" aria-label="Conta">
            <div className="sb-menu-who">
              <span className="avatar">{conta.inicial}</span>
              <span>
                <b>{conta.nome}</b>
                <span className="sub">{conta.email}</span>
              </span>
            </div>
            <hr />
            <div className="sb-menu-title">Suas empresas</div>
            <button type="button" role="menuitemradio" aria-checked="true">
              <span className="sb-unit-av">
                <Icon name="store" />
              </span>
              <span>
                <b>{empresa}</b>
              </span>
              <Icon name="check" className="ok" />
            </button>
            <button type="button" role="menuitem" disabled>
              <Icon name="plus" />
              <span>Adicionar empresa</span>
              <span className="badge future" style={{ marginLeft: 'auto' }}>
                Futuro
              </span>
            </button>
            <hr />
            <div className="sb-menu-title">Aparência</div>
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={palette === p.id}
                onClick={() => setPalette(p.id)}
              >
                <span className="sws" aria-hidden="true">
                  {p.cores.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span>{p.nome}</span>
                {palette === p.id && <Icon name="check" className="ok" />}
              </button>
            ))}
            <hr />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAberto(false)
                onNavigate()
                navigate('/trocar-senha')
              }}
            >
              <Icon name="lock" />
              <span>Alterar senha</span>
            </button>
            <button type="button" role="menuitem">
              <Icon name="help" />
              <span>Ajuda</span>
            </button>
            <button type="button" role="menuitem" className="sb-menu-out" onClick={sair}>
              <Icon name="logout" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {dica && (
        <div className="sb-tip show" role="tooltip" style={{ left: dica.left, top: dica.top }}>
          {dica.text}
        </div>
      )}
    </aside>
  )
}
