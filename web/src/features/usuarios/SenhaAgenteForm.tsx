import { useState, type FormEvent } from 'react'
import { Button, TextField } from '../../components/ui'

/**
 * O Dono define a senha do Agente (DEC-59): o agente não tem convite nem
 * "Esqueci a senha" por email, então é aqui que ele ganha uma senha nova.
 */
export function SenhaAgenteForm({
  nome,
  onSubmit,
  submitting,
  serverError,
  onCancel,
}: {
  nome: string
  onSubmit: (novaSenha: string) => void
  submitting: boolean
  serverError?: string | null
  onCancel: () => void
}) {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (senha.length < 8) e.senha = 'A senha precisa ter no mínimo 8 caracteres.'
    else if (confirma !== senha) e.confirma = 'As senhas não conferem.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onSubmit(senha)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form">
        {serverError && (
          <p className="form-error" role="alert">
            {serverError}
          </p>
        )}
        <p className="hint" style={{ margin: 0 }}>
          A senha atual de {nome} deixa de valer. Passe a nova senha para o agente entrar no app.
        </p>
        <TextField
          label="Nova senha"
          type="password"
          value={senha}
          onChange={setSenha}
          error={errors.senha}
          hint="Mínimo de 8 caracteres."
          required
          maxLength={128}
          autoComplete="new-password"
        />
        <TextField
          label="Repita a senha"
          type="password"
          value={confirma}
          onChange={setConfirma}
          error={errors.confirma}
          required
          maxLength={128}
          autoComplete="new-password"
        />
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Definir senha'}
        </Button>
      </div>
    </form>
  )
}
