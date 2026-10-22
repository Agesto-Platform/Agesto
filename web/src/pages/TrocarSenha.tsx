import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/Icon'
import { ApiError } from '../lib/api'
import './login.css'

/** Campo de senha no padrão do login (`.lfield` + `.ibox` com cadeado). */
function SenhaField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  autoFocus?: boolean
  hint?: string
}) {
  return (
    <div className="lfield">
      <label htmlFor={id}>{label}</label>
      <div className="ibox">
        <span>
          <Icon name="lock" />
        </span>
        <input
          className="input"
          id={id}
          type="password"
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? id + '-hint' : undefined}
        />
      </div>
      {hint && (
        <span className="hint" id={id + '-hint'}>
          {hint}
        </span>
      )}
    </div>
  )
}

/** Troca de senha: obrigatória no primeiro acesso com senha provisória. Mesmo cartão do login. */
export function TrocarSenha() {
  const { trocarSenha, deveTrocarSenha, logout } = useAuth()
  const navigate = useNavigate()

  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.')
    if (nova === atual) return setErro('A nova senha deve ser diferente da atual.')
    setErro(null)
    setLoading(true)
    try {
      await trocarSenha(atual, nova)
      navigate('/', { replace: true })
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível trocar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <span className="logo">A</span>Agesto
      </header>
      <main className="login" id="page">
        <section className="login-card" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>{deveTrocarSenha ? 'Crie sua senha' : 'Alterar senha'}</span>
            <span className="muted">
              {deveTrocarSenha
                ? 'A senha provisória vale só para o primeiro acesso.'
                : 'Informe a senha atual e escolha a nova.'}
            </span>
          </h1>

          <form className="lform" onSubmit={handleSubmit} noValidate>
            <SenhaField
              id="senha-atual"
              label={deveTrocarSenha ? 'Senha provisória' : 'Senha atual'}
              value={atual}
              onChange={setAtual}
              autoComplete="current-password"
              autoFocus
            />
            <SenhaField
              id="senha-nova"
              label="Nova senha"
              value={nova}
              onChange={setNova}
              autoComplete="new-password"
              hint="No mínimo 8 caracteres."
            />
            <SenhaField
              id="senha-confirma"
              label="Confirme a nova senha"
              value={confirma}
              onChange={setConfirma}
              autoComplete="new-password"
            />
            {erro && (
              <p className="login-error" role="alert">
                {erro}
              </p>
            )}
            <button className="btn primary go" type="submit" aria-busy={loading}>
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>

          <p className="legal">
            {deveTrocarSenha ? (
              <button className="btn ghost sm" type="button" onClick={logout}>
                <Icon name="logout" />
                Sair
              </button>
            ) : (
              <button className="btn ghost sm" type="button" onClick={() => navigate(-1)}>
                <Icon name="left" />
                Voltar
              </button>
            )}
          </p>
        </section>
      </main>
    </div>
  )
}
