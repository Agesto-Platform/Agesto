import { useRef, type ReactNode } from 'react'
import { Icon } from '../Icon'
import { useFocusTrap } from './useFocusTrap'

/**
 * Painel lateral da direita (formulários e detalhes), no mesmo desenho do
 * painel do Agente. Fecha no Esc, no X e no clique fora; prende o foco.
 */
export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  sub?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open, onClose)

  return (
    <div className={`drawer${open ? ' open' : ''}`} inert={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer-panel" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="drawer-head">
          <div>
            <b>{title}</b>
            {sub && <span className="sub">{sub}</span>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  )
}
