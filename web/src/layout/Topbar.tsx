import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { NAV_LOOKUP } from './nav'
import { Icon, PanelIcon } from '../components/Icon'
import { Seg } from '../components/ui'
import { setMode, useTheme, type Mode } from '../theme/theme'

const EXTRAS: Record<string, { grupo: string; label: string }> = {
  '/trocar-senha': { grupo: 'Conta', label: 'Alterar senha' },
}

export function Topbar({
  agentOpen,
  onToggleAgent,
  onOpenNav,
}: {
  agentOpen: boolean
  onToggleAgent: () => void
  onOpenNav: () => void
}) {
  const { pathname } = useLocation()
  const page = NAV_LOOKUP[pathname] ?? EXTRAS[pathname] ?? { grupo: 'Agesto', label: '' }
  const { mode } = useTheme()
  const searchRef = useRef<HTMLInputElement>(null)

  // Ctrl K / ⌘K leva para a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" type="button" onClick={onOpenNav} aria-label="Abrir menu">
        <Icon name="menu" />
      </button>
      <div className="crumbs">
        {page.grupo} <span aria-hidden="true">/</span> <b>{page.label}</b>
      </div>
      <label className="search">
        <Icon name="search" />
        <input ref={searchRef} type="search" placeholder="Buscar clientes, orçamentos…" aria-label="Buscar" />
        <span className="kbd">Ctrl K</span>
      </label>
      <span className="spacer" />
      <a className="help-link" href="#" onClick={(e) => e.preventDefault()}>
        Precisa de ajuda?
      </a>
      <Seg<Mode>
        className="mode"
        label="Tema"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'light', label: <Icon name="sun" />, ariaLabel: 'Tema claro' },
          { value: 'dark', label: <Icon name="moon" />, ariaLabel: 'Tema escuro' },
        ]}
      />
      <button className="icon-btn" type="button" aria-label="Notificações">
        <Icon name="bell" />
        <span className="dot" />
      </button>
      <button
        className="icon-btn"
        type="button"
        onClick={onToggleAgent}
        aria-pressed={agentOpen}
        aria-label="Mostrar ou esconder o Agente"
        data-agent-toggle
      >
        <PanelIcon />
      </button>
    </header>
  )
}
