import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'
import { api, ApiError } from '../lib/api'
import type { PerfilUsuario } from '../types/api'
import { SenhaField } from './SenhaField'
import './login.css'

/**
 * Lê o token do link do email. Ele vem depois do `#` (DEC-54): o navegador não
 * manda essa parte para o servidor, então o token não fica em logs nem no Referer.
 */
function tokenDoLink(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
}

type Modo = 'redefinir' | 'convite' | 'admin'

const TEXTO: Record<Modo, { titulo: string; sub: string; feito: string; minimo: number; rota: string }> = {
  // "Esqueci a senha" (DEC-54): link de 15 minutos.
  redefinir: {
    titulo: 'Crie uma senha nova',
    sub: 'Escolha a senha que vai usar daqui em diante.',
    feito: 'Senha alterada',
    minimo: 8,
    rota: '/api/auth/redefinir-senha',
  },
  // Convite do Dono ou da equipe do Agesto (DEC-55): link de 72 horas.
  convite: {
    titulo: 'Crie a sua senha',
    sub: 'Bem-vindo ao Agesto. Escolha a senha do seu acesso.',
    feito: 'Senha criada',
    minimo: 8,
    rota: '/api/auth/redefinir-senha',
  },
  // Convite para a equipe do Agesto (área de superadmin).
  admin: {
    titulo: 'Crie a sua senha de administrador',
    sub: 'Acesso à área de administração do Agesto. Use uma senha longa.',
    feito: 'Senha criada',
    minimo: 12,
    rota: '/api/admin/auth/criar-senha',
  },
}

function PaginaDeSenha({ modo }: { modo: Modo }) {
  const t = TEXTO[modo]
  const [token] = useState(tokenDoLink)
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    if (nova.length < t.minimo) return setErro(`A nova senha deve ter no mínimo ${t.minimo} caracteres.`)
    if (nova !== confirma) return setErro('A confirmação não confere com a nova senha.')
    setErro(null)
    setLoading(true)
    try {
      const r = await api.post<{ perfil?: PerfilUsuario } | null>(t.rota, { token, novaSenha: nova })
      setPerfil(r?.perfil ?? null)
      // Tira o token da barra de endereço e do histórico.
      window.history.replaceState(null, '', window.location.pathname)
      setPronto(true)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar a senha agora.')
    } finally {
      setLoading(false)
    }
  }

  // O agente entra pelo app; o Dono, pelo painel; a equipe, pela área de admin.
  const depois =
    modo === 'admin'
      ? { texto: 'Agora é só entrar na área de administração.', link: '/admin/login', botao: 'Ir para a área de administração' }
      : perfil === 'Agente'
        ? { texto: 'Agora abra o app do Agesto no celular e entre com o seu email e esta senha.', link: '/baixar', botao: 'Ainda não tenho o app' }
        : { texto: 'Agora é só entrar com a senha nova.', link: '/login', botao: 'Ir para o login' }

  return (
    <div className="login-page" style={{ overflowY: 'auto' }}>
      <header className="login-top">
        <Logo />Agesto
      </header>
      <main className="login" id="page">
        <section className="login-card" aria-labelledby="ttl">
          <h1 className="login-title" id="ttl">
            <span>{pronto ? t.feito : t.titulo}</span>
            <span className="muted">
              {pronto ? depois.texto : token ? t.sub : 'Este link está incompleto. Abra de novo o link do e-mail.'}
            </span>
          </h1>

          {pronto ? (
            <div className="lform">
              <Link className="btn primary go" to={depois.link} replace>
                {depois.botao}
              </Link>
            </div>
          ) : token ? (
            <form className="lform" onSubmit={handleSubmit} noValidate>
              <SenhaField
                id="senha-nova"
                label="Nova senha"
                value={nova}
                onChange={setNova}
                autoComplete="new-password"
                autoFocus
                hint={`No mínimo ${t.minimo} caracteres.`}
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
                {loading ? 'Salvando…' : 'Salvar senha nova'}
              </button>
            </form>
          ) : null}

          {!pronto &&
            (modo === 'admin' ? (
              <p className="legal hint">Link vencido? Peça a alguém da equipe para reenviar o convite.</p>
            ) : (
              <p className="legal">
                <Link className="btn ghost sm" to="/esqueci-senha">
                  <Icon name="mail" />
                  Pedir um link novo
                </Link>
              </p>
            ))}
        </section>
      </main>
    </div>
  )
}

/** Senha nova pelo link de "Esqueci a senha" (DEC-54). */
export function RedefinirSenha() {
  return <PaginaDeSenha modo="redefinir" />
}

/** Primeira senha pelo convite do Dono ou da equipe do Agesto (DEC-55). */
export function CriarSenha() {
  return <PaginaDeSenha modo="convite" />
}

/** Senha de quem foi convidado para a equipe do Agesto (DEC-55). */
export function AdminCriarSenha() {
  return <PaginaDeSenha modo="admin" />
}
