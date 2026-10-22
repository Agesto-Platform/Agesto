import { Badge, type BadgeTone } from '../../components/ui'
import type { IconName } from '../../components/Icon'
import type { StatusAtendimento } from '../../types/api'

const MAP: Record<StatusAtendimento, { tone: BadgeTone; icon: IconName; label: string }> = {
  Concluido: { tone: 'ok', icon: 'check', label: 'Concluído' },
  Pendente: { tone: 'warn', icon: 'clock', label: 'Pendente' },
  Cancelado: { tone: 'neg', icon: 'x', label: 'Cancelado' },
}

export function StatusAtendimentoPill({ status }: { status: StatusAtendimento }) {
  const s = MAP[status]
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  )
}
