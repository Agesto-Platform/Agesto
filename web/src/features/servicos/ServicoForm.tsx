import { useState, type FormEvent } from 'react'
import type { Servico, ServicoInput, TipoCobranca } from '../../types/api'
import { Button, TextField, NumberField, SelectField } from '../../components/ui'
import { ServicoSugeridosEditor } from './ServicoSugeridosEditor'

interface FormState {
  descricao: string
  tipoCobranca: TipoCobranca
  valor: number | undefined
}

function toState(s: Servico | null): FormState {
  if (!s) return { descricao: '', tipoCobranca: 'PorHora', valor: undefined }
  return {
    descricao: s.descricao,
    tipoCobranca: s.tipoCobranca,
    valor: (s.tipoCobranca === 'PorHora' ? s.valorHora : s.valorEmpreitada) ?? undefined,
  }
}

export function ServicoForm({
  initial,
  onSubmit,
  submitting,
  serverError,
  onCancel,
  onDelete,
}: {
  initial: Servico | null
  onSubmit: (input: ServicoInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
  /** Só na edição: abre a confirmação de exclusão. */
  onDelete?: () => void
}) {
  const [form, setForm] = useState<FormState>(() => toState(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const porHora = form.tipoCobranca === 'PorHora'

  function validate(): boolean {
    const e: Record<string, string> = {}
    const d = form.descricao.trim()
    if (d.length < 2) e.descricao = 'Descrição deve ter no mínimo 2 caracteres.'
    else if (d.length > 200) e.descricao = 'Descrição deve ter no máximo 200 caracteres.'
    if (form.valor === undefined || form.valor < 0.01)
      e.valor = 'Informe um valor maior que zero.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({
      descricao: form.descricao.trim(),
      tipoCobranca: form.tipoCobranca,
      valorHora: porHora ? form.valor : null,
      valorEmpreitada: porHora ? null : form.valor,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <TextField
          label="Descrição"
          value={form.descricao}
          onChange={(v) => setForm((f) => ({ ...f, descricao: v }))}
          error={errors.descricao}
          required
          maxLength={200}
        />
        <div className="form-row">
          <SelectField<TipoCobranca>
            label="Cobrança"
            value={form.tipoCobranca}
            onChange={(v) => setForm((f) => ({ ...f, tipoCobranca: v }))}
            options={[
              { value: 'PorHora', label: 'Por hora' },
              { value: 'Empreitada', label: 'Empreitada' },
            ]}
            required
          />
          <NumberField
            label={porHora ? 'Valor por hora' : 'Valor da empreitada'}
            prefix="R$"
            step={0.01}
            value={form.valor}
            onChange={(v) => setForm((f) => ({ ...f, valor: v }))}
            error={errors.valor}
            required
          />
        </div>
      </div>

      {initial && <ServicoSugeridosEditor servicoId={initial.id} />}

      <div className="form-actions">
        {onDelete && (
          <Button variant="ghost" onClick={onDelete} disabled={submitting} style={{ marginRight: 'auto' }}>
            Excluir
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
