import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { useFocusTrap } from './useFocusTrap'

/** Diálogo de confirmação centralizado (usado no excluir). Abre no <body>, como o Drawer. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  loadingLabel = 'Excluindo…',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  loadingLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open, onCancel)
  if (!open) return null
  return createPortal(
    <div className="dialog">
      <div className="drawer-scrim" onClick={onCancel} />
      <div className="dialog-box" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <h3 id="dialog-title">{title}</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <Button onClick={onCancel} disabled={loading} data-autofocus>
            Cancelar
          </Button>
          <Button variant="accent" onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
