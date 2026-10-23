import { useState, type FormEvent } from 'react'
import type { PerfilUsuario, Usuario, UsuarioCreateInput } from '../../types/api'
import { Button, SelectField, TextField } from '../../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PERFIS: { value: PerfilUsuario; label: string }[] = [
  { value: 'Agente', label: 'Agente (usa o app em campo)' },
  { value: 'Dono', label: 'Dono (acessa este painel)' },
]

/**
 * Cadastro e edição de usuário. Na edição o email fica fixo: é o login da
 * pessoa e trocá-lo exige outro fluxo.
 */
export function UsuarioForm({
  initial,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  initial: Usuario | null
  onSubmit: (input: UsuarioCreateInput) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [perfil, setPerfil] = useState<PerfilUsuario>(initial?.perfil ?? 'Agente')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (nome.trim().length < 2) e.nome = 'Nome deve ter no mínimo 2 caracteres.'
    if (!initial && !EMAIL_RE.test(email.trim())) e.email = 'Informe um email válido.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onSubmit({ nome: nome.trim(), email: email.trim(), perfil })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}

        <TextField label="Nome" value={nome} onChange={setNome} error={errors.nome} required maxLength={120} />

        {initial ? (
          <div className="field">
            <span className="section-label">Email</span>
            <span className="hint" style={{ fontSize: 13 }}>
              {initial.email} · é o login, não muda por aqui
            </span>
          </div>
        ) : (
          <TextField
            label="Email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            required
            maxLength={150}
            placeholder="pessoa@empresa.com"
            autoComplete="off"
          />
        )}

        <SelectField label="Perfil" value={perfil} onChange={setPerfil} options={PERFIS} required />

        {!initial && (
          <p className="hint" style={{ margin: 0 }}>
            Ao salvar, o sistema gera uma senha provisória. A pessoa entra com ela e troca no primeiro acesso.
          </p>
        )}
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando…' : initial ? 'Salvar' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  )
}
