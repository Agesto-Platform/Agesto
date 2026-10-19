import { NavLink } from 'react-router-dom'
import { navVisivel } from './nav'
import { useAuth } from '../auth/useAuth'
import { useConfiguracao } from '../features/parametrizacao/queries'

export function Sidebar() {
  const { user, logout } = useAuth()
  const config = useConfiguracao()
  const nav = navVisivel(config.data?.tipoOperacao)
  const email = user?.email ?? ''
  const initial = email ? email[0]!.toUpperCase() : '—'

  return (
    <aside className="sticky top-0 flex h-screen w-[238px] flex-none flex-col gap-[5px] border-r border-line bg-surface px-[14px] py-[18px] max-[820px]:hidden">
      {/* Marca */}
      <div className="flex items-center gap-[11px] px-2 pb-4 pt-1">
        <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-brand to-brand-ink text-base font-extrabold text-white">
          A
        </div>
        <div>
          <b className="block text-base tracking-tight text-ink">Agesto</b>
          <span className="block text-[11px] font-medium text-ink-4">
            Painel do Dono
          </span>
        </div>
      </div>

      {nav.map((group) => (
        <div key={group.label}>
          <div className="px-2.5 pb-[5px] pt-3.5 text-[10px] font-bold uppercase tracking-[0.09em] text-ink-4">
            {group.label}
          </div>
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-medium transition ${
                    isActive
                      ? 'bg-brand-soft font-semibold text-brand-ink'
                      : 'text-ink-2 hover:bg-surface-2'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px] opacity-85" />
                <span>{item.label}</span>
                {item.count != null && (
                  <span className="ml-auto rounded-full bg-brand px-[7px] py-px text-[11px] font-bold text-white">
                    {item.count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      ))}

      {/* Rodapé — conta autenticada */}
      <div className="mt-auto flex items-center gap-2.5 border-t border-line-2 p-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-brand text-[12px] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">
            {email || 'Minha conta'}
          </div>
          <NavLink to="/trocar-senha" className="text-[11px] text-ink-4 hover:text-brand-ink">
            Alterar senha
          </NavLink>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sair"
          title="Sair"
          className="grid h-8 w-8 flex-none place-items-center rounded-[9px] text-ink-4 transition hover:bg-surface-2 hover:text-bad"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
