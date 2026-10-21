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
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex flex-col gap-4 px-5 py-4">
        {serverError && (
          <p className="rounded-sm bg-bad-soft px-3 py-2 text-[12.5px] font-medium text-bad">
            {serverError}
          </p>
        )}

        <TextField label="Nome" value={nome} onChange={setNome} error={errors.nome} required maxLength={120} />

        {initial ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-ink-2">Email</span>
            <span className="text-[14px] text-ink-3">{initial.email}</span>
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
          />
        )}

        <SelectField label="Perfil" value={perfil} onChange={setPerfil} options={PERFIS} required />

        {!initial && (
          <p className="text-[12px] text-ink-4">
            Ao salvar, o sistema gera uma senha provisória. A pessoa entra com ela e troca no primeiro
            acesso.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="ghost" type="button" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : initial ? 'Salvar' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  )
}
