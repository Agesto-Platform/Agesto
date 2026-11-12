import { useState, type FormEvent } from 'react'
import type { Cliente, AtendimentoInput, StatusAtendimento, Usuario } from '../../types/api'
import { Button, SelectField, TextField } from '../../components/ui'
import { ClienteField } from '../../components/CamposDeEscolha'

const STATUS_OPCOES: { value: StatusAtendimento; label: string }[] = [
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Concluido', label: 'Concluído' },
  { value: 'Cancelado', label: 'Cancelado' },
]

export function AtendimentoForm({
  responsaveis,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  responsaveis: Usuario[]
  onSubmit: (input: AtendimentoInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  // PAG-01 fase 2: o cliente vem da busca no servidor, não de uma lista inteira.
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [status, setStatus] = useState<StatusAtendimento>('Pendente')
  const [agenda, setAgenda] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cliente) {
      setError('Selecione um cliente.')
      return
    }
    setError(null)
    onSubmit({
      clienteId: cliente.id,
      status,
      dataAgendada: agenda ? new Date(agenda).toISOString() : null,
      responsavelId: responsavel ? Number(responsavel) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {serverError}
          </p>
        )}

        <ClienteField required value={cliente} onChange={setCliente} error={error ?? undefined} />

        <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPCOES} />

        <SelectField
          label="Responsável"
          value={responsavel}
          onChange={setResponsavel}
          hint="O atendimento aparece na agenda do app de quem for o responsável."
          options={[
            { value: '', label: 'Eu mesmo' },
            ...responsaveis.map((u) => ({
              value: String(u.id),
              label: u.nome + (u.perfil === 'Dono' ? ' (dono)' : ''),
            })),
          ]}
        />

        <TextField label="Agendar para (opcional)" type="datetime-local" value={agenda} onChange={setAgenda} />

        <p className="hint" style={{ margin: 0 }}>
          Os itens (produtos e serviços) entram no detalhe, depois de criar.
        </p>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar atendimento'}
        </Button>
      </div>
    </form>
  )
}
