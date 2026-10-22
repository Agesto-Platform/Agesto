import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from './toastContext'
import { Icon } from '../../Icon'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, tone, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <Icon name={t.tone === 'success' ? 'okc' : 'xc'} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
