import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui'
import { ApiError } from '../lib/api'

const inputCls =
  'rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand'

/** Troca de senha: obrigatória no primeiro acesso com senha provisória. */
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
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card"
      >
        <div>
          <h1 className="text-[17px] font-semibold text-ink">
            {deveTrocarSenha ? 'Crie sua senha' : 'Alterar senha'}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            {deveTrocarSenha
              ? 'Você entrou com uma senha provisória. Defina uma senha só sua para continuar.'
              : 'Informe a senha atual e escolha a nova.'}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">
            {deveTrocarSenha ? 'Senha provisória' : 'Senha atual'}
          </span>
          <input type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Nova senha</span>
          <input type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-2">Confirme a nova senha</span>
          <input type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={inputCls} />
        </label>

        {erro && (
          <p className="rounded-sm bg-bad-soft px-3 py-2 text-[12.5px] font-medium text-bad">{erro}</p>
        )}

        <Button type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
        {deveTrocarSenha ? (
          <button type="button" onClick={logout} className="text-[12.5px] font-semibold text-ink-3 hover:text-ink-2">
            Sair
          </button>
        ) : (
          <button type="button" onClick={() => navigate(-1)} className="text-[12.5px] font-semibold text-ink-3 hover:text-ink-2">
            Voltar
          </button>
        )}
      </form>
    </div>
  )
}
