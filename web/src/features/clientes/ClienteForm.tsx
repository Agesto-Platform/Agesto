import { useState, type FormEvent } from 'react'
import type { Cliente, ClienteInput } from '../../types/api'
import { Button, TextField } from '../../components/ui'
import { maskCpf, maskPhone, maskCep, onlyDigits } from '../../lib/masks'
import { cpfValido } from '../../lib/cpf'

const EMPTY: ClienteInput = {
  nome: '', telefone: '', cpf: '', logradouro: '', numero: '', bairro: '', cidade: '', cep: '',
}

function toInput(c: Cliente): ClienteInput {
  return {
    nome: c.nome, telefone: c.telefone ?? '', cpf: c.cpf, logradouro: c.logradouro ?? '',
    numero: c.numero ?? '', bairro: c.bairro ?? '', cidade: c.cidade ?? '', cep: c.cep ?? '',
  }
}

/** Normaliza strings vazias de campos opcionais para null antes de enviar. */
function normalize(f: ClienteInput): ClienteInput {
  return {
    nome: f.nome.trim(),
    cpf: f.cpf.trim(),
    telefone: f.telefone || null,
    logradouro: f.logradouro || null,
    numero: f.numero || null,
    bairro: f.bairro || null,
    cidade: f.cidade || null,
    cep: f.cep || null,
  }
}

export function ClienteForm({
  initial,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  initial: Cliente | null
  onSubmit: (input: ClienteInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  const [form, setForm] = useState<ClienteInput>(() =>
    initial ? toInput(initial) : EMPTY,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (key: keyof ClienteInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  function validate(): boolean {
    const e: Record<string, string> = {}
    const nome = form.nome.trim()
    if (nome.length < 2) e.nome = 'Nome deve ter no mínimo 2 caracteres.'
    else if (nome.length > 120) e.nome = 'Nome deve ter no máximo 120 caracteres.'
    if (onlyDigits(form.cpf).length !== 11) e.cpf = 'CPF deve ter 11 dígitos.'
    else if (!cpfValido(form.cpf)) e.cpf = 'CPF inválido. Confira os números.'
    if ((form.telefone ?? '').length > 20) e.telefone = 'Telefone muito longo.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit(normalize(form))
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert" style={{ margin: 0 }}>
            {serverError}
          </p>
        )}

        <TextField
          label="Nome"
          value={form.nome}
          onChange={(v) => set('nome', v)}
          error={errors.nome}
          required
          maxLength={120}
        />

        <div className="form-row">
          <TextField
            label="CPF"
            value={form.cpf}
            onChange={(v) => set('cpf', maskCpf(v))}
            error={errors.cpf}
            required
            placeholder="000.000.000-00"
          />
          <TextField
            label="Telefone"
            value={form.telefone ?? ''}
            onChange={(v) => set('telefone', maskPhone(v))}
            error={errors.telefone}
            placeholder="(00) 00000-0000"
            type="tel"
          />
        </div>

        <div className="section-label" style={{ paddingTop: 4 }}>
          Endereço
        </div>

        <TextField
          label="Logradouro"
          value={form.logradouro ?? ''}
          onChange={(v) => set('logradouro', v)}
          maxLength={150}
        />
        <div className="form-row">
          <TextField
            label="Número"
            value={form.numero ?? ''}
            onChange={(v) => set('numero', v)}
            maxLength={20}
          />
          <TextField
            label="Bairro"
            value={form.bairro ?? ''}
            onChange={(v) => set('bairro', v)}
            maxLength={100}
          />
        </div>
        <div className="form-row">
          <TextField
            label="Cidade"
            value={form.cidade ?? ''}
            onChange={(v) => set('cidade', v)}
            maxLength={100}
          />
          <TextField
            label="CEP"
            value={form.cep ?? ''}
            onChange={(v) => set('cep', maskCep(v))}
            placeholder="00000-000"
          />
        </div>
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}
