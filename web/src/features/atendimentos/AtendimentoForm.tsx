import { useState, type FormEvent } from 'react'
import type { Cliente, AtendimentoInput, StatusAtendimento, Usuario } from '../../types/api'
import { Button } from '../../components/ui'

const selectCls =
  'rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand'

export function AtendimentoForm({
  clientes,
  responsaveis,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  clientes: Cliente[]
  responsaveis: Usuario[]
  onSubmit: (input: AtendimentoInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  const [clienteId, setClienteId] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<StatusAtendimento>('Pendente')
  const [agenda, setAgenda] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (clienteId === undefined) {
      setError('Selecione um cliente.')
      return
    }
    setError(null)
    onSubmit({
      clienteId,
      status,
      dataAgendada: agenda ? new Date(agenda).toISOString() : null,
      responsavelId: responsavel ? Number(responsavel) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-4 px-5 py-4">
        {serverError && (
          <p className="rounded-sm bg-bad-soft px-3 py-2 text-[12.5px] font-medium text-bad">
            {serverError}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">
            Cliente<span className="text-bad"> *</span>
          </span>
          <select
            value={clienteId ?? ''}
            onChange={(e) =>
              setClienteId(e.target.value === '' ? undefined : Number(e.target.value))
            }
            className={`${selectCls} ${error ? 'border-bad' : ''}`}
          >
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {error && <span className="text-[12px] text-bad">{error}</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusAtendimento)}
            className={selectCls}
          >
            <option value="Pendente">Pendente</option>
            <option value="Concluido">Concluído</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Responsável</span>
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={selectCls}>
            <option value="">Eu mesmo</option>
            {responsaveis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
                {u.perfil === 'Dono' ? ' (dono)' : ''}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-ink-4">
            O atendimento aparece na agenda do app de quem for o responsável.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">
            Agendar para (opcional)
          </span>
          <input
            type="datetime-local"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            className={selectCls}
          />
        </label>

        <p className="text-[12px] text-ink-4">
          Os itens (produtos/serviços) são adicionados no detalhe, após criar.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" type="button" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar atendimento'}
        </Button>
      </div>
    </form>
  )
}
