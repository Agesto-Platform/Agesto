import { useState, type FormEvent } from 'react'
import type { PerfilUsuario, Usuario, UsuarioCreateInput } from '../../types/api'
import { Button, SelectField, TextField } from '../../components/ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Login do Agente (DEC-59): só o formato algo@algo, o email não precisa existir.
const LOGIN_RE = /^[^\s@]+@[^\s@]+$/

const PERFIS: { value: PerfilUsuario; label: string }[] = [
  { value: 'Agente', label: 'Agente (usa o app em campo)' },
  { value: 'Dono', label: 'Dono (acessa este painel)' },
]

/**
 * Cadastro e edição de usuário. Na edição o email fica fixo: é o login da
 * pessoa e trocá-lo exige outro fluxo. O Agente nasce com a senha que o Dono
 * define e o email dele é só o login (DEC-59); o Dono recebe convite por email.
 * Exceção: ao promover um Agente a Dono, o email real é pedido e recebe o
 * convite, porque o login do agente pode ser inventado (KAN-32).
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
  const [senha, setSenha] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const agenteNovo = !initial && perfil === 'Agente'
  const promovendo = initial?.perfil === 'Agente' && perfil === 'Dono'

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (nome.trim().length < 2) e.nome = 'Nome deve ter no mínimo 2 caracteres.'
    if (!initial && !(agenteNovo ? LOGIN_RE : EMAIL_RE).test(email.trim()))
      e.email = agenteNovo ? 'Use o formato nome@empresa.' : 'Informe um email válido.'
    if (promovendo && !EMAIL_RE.test(email.trim())) e.email = 'Informe o email real da pessoa, por exemplo nome@gmail.com.'
    if (agenteNovo && senha.length < 8) e.senha = 'A senha precisa ter no mínimo 8 caracteres.'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    onSubmit(agenteNovo ? { nome: nome.trim(), email: email.trim(), perfil, senha } : { nome: nome.trim(), email: email.trim(), perfil })
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

        {promovendo ? (
          <TextField
            label="Email real"
            value={email}
            onChange={setEmail}
            error={errors.email}
            hint="O Dono precisa de um email que existe: ele recebe um convite para confirmar e passa a ter o “Esqueci a senha”."
            required
            maxLength={150}
            placeholder="pessoa@empresa.com"
            autoComplete="off"
          />
        ) : initial ? (
          <div className="field">
            <span className="section-label">Email</span>
            <span className="hint" style={{ fontSize: 13 }}>
              {initial.email} · é o login, não muda por aqui
            </span>
          </div>
        ) : (
          <TextField
            label={agenteNovo ? 'Email (login no app)' : 'Email'}
            value={email}
            onChange={setEmail}
            error={errors.email}
            hint={agenteNovo ? 'Não precisa ser um email real: é só o login do agente no app.' : undefined}
            required
            maxLength={150}
            placeholder={agenteNovo ? 'joao@suaempresa' : 'pessoa@empresa.com'}
            autoComplete="off"
          />
        )}

        <SelectField label="Perfil" value={perfil} onChange={setPerfil} options={PERFIS} required />

        {agenteNovo && (
          <TextField
            label="Senha"
            type="password"
            value={senha}
            onChange={setSenha}
            error={errors.senha}
            hint="Mínimo de 8 caracteres. Passe a senha para o agente."
            required
            maxLength={128}
            autoComplete="new-password"
          />
        )}

        {promovendo && (
          <p className="hint" style={{ margin: 0 }}>
            Até usar o convite, a pessoa continua entrando com a senha atual. O link vale por 72 horas.
          </p>
        )}

        {!initial && (
          <p className="hint" style={{ margin: 0 }}>
            {agenteNovo
              ? 'O agente entra no app com este email e a senha. Se esquecer, você define uma nova aqui.'
              : 'Ao salvar, a pessoa recebe um convite neste email para criar a própria senha. O link vale por 72 horas.'}
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
