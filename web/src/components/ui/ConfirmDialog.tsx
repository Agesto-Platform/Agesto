import { Button } from './Button'

/** Diálogo de confirmação centralizado (usado no excluir). */
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-card">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] text-ink-3">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-bad px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
