import { useState, type FormEvent } from 'react'
import type { Produto, ProdutoInput } from '../../types/api'
import { Button, TextField, NumberField } from '../../components/ui'

interface FormState {
  nome: string
  preco: number | undefined
  quantidadeEstoque: number | undefined
}

function toState(p: Produto | null): FormState {
  return p
    ? { nome: p.nome, preco: p.preco, quantidadeEstoque: p.quantidadeEstoque }
    : { nome: '', preco: undefined, quantidadeEstoque: undefined }
}

export function ProdutoForm({
  initial,
  onSubmit,
  submitting,
  serverError,
  onCancel,
  onDelete,
  controlaEstoque = true,
}: {
  initial: Produto | null
  onSubmit: (input: ProdutoInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
  /** Só na edição: abre a confirmação de exclusão. */
  onDelete?: () => void
  controlaEstoque?: boolean
}) {
  const [form, setForm] = useState<FormState>(() => toState(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    const nome = form.nome.trim()
    if (nome.length < 2) e.nome = 'Nome deve ter no mínimo 2 caracteres.'
    else if (nome.length > 120) e.nome = 'Nome deve ter no máximo 120 caracteres.'
    if (form.preco === undefined || form.preco < 0.01) e.preco = 'Preço deve ser maior que zero.'
    // Estoque só é validado quando a empresa controla estoque.
    if (controlaEstoque) {
      if (form.quantidadeEstoque === undefined || form.quantidadeEstoque < 0)
        e.quantidadeEstoque = 'Quantidade inválida.'
      else if (!Number.isInteger(form.quantidadeEstoque))
        e.quantidadeEstoque = 'Quantidade deve ser um número inteiro.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({
      nome: form.nome.trim(),
      preco: form.preco!,
      // Sem controle de estoque: preserva o valor atual (edição) ou 0 (novo).
      quantidadeEstoque: controlaEstoque ? form.quantidadeEstoque! : (form.quantidadeEstoque ?? 0),
    })
  }

  const preco = (
    <NumberField
      label="Preço"
      prefix="R$"
      step={0.01}
      value={form.preco}
      onChange={(v) => setForm((f) => ({ ...f, preco: v }))}
      error={errors.preco}
      required
    />
  )

  return (
    <form onSubmit={handleSubmit}>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <TextField
          label="Nome"
          value={form.nome}
          onChange={(v) => setForm((f) => ({ ...f, nome: v }))}
          error={errors.nome}
          required
          maxLength={120}
        />
        {controlaEstoque ? (
          <div className="form-row">
            {preco}
            <NumberField
              label="Estoque"
              step={1}
              value={form.quantidadeEstoque}
              onChange={(v) => setForm((f) => ({ ...f, quantidadeEstoque: v }))}
              error={errors.quantidadeEstoque}
              hint="Baixa sozinho quando um orçamento aprovado vira atendimento."
              required
            />
          </div>
        ) : (
          preco
        )}
      </div>

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
