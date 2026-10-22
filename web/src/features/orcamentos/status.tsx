import { Badge, type BadgeTone } from '../../components/ui'
import type { IconName } from '../../components/Icon'
import type { StatusOrcamento } from '../../types/api'

const MAP: Record<StatusOrcamento, { tone: BadgeTone; icon: IconName; label: string }> = {
  Rascunho: { tone: 'neutral', icon: 'pencil', label: 'Rascunho' },
  Enviado: { tone: 'info', icon: 'send', label: 'Enviado' },
  Aprovado: { tone: 'ok', icon: 'check', label: 'Aprovado' },
  Recusado: { tone: 'neg', icon: 'x', label: 'Recusado' },
}

export function StatusOrcamentoPill({ status }: { status: StatusOrcamento }) {
  const s = MAP[status]
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  )
}
