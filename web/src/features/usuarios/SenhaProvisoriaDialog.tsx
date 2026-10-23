import { useCallback, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import { useFocusTrap } from '../../components/ui/useFocusTrap'
import type { UsuarioSenhaProvisoria } from '../../types/api'

/** Mostra a senha provisória uma única vez, com botão de copiar. */
export function SenhaProvisoriaDialog({
  dados,
  onClose,
}: {
  dados: UsuarioSenhaProvisoria | null
  onClose: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => {
    setCopiado(false)
    onClose()
  }, [onClose])
  useFocusTrap(ref, dados !== null, fechar)
  if (!dados) return null

  async function copiar() {
    try {
      await navigator.clipboard.writeText(dados!.senhaProvisoria)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="dialog">
      <div className="drawer-scrim" />
      <div
        className="dialog-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="senha-provisoria-titulo"
        ref={ref}
      >
        <h3 id="senha-provisoria-titulo">Senha provisória de {dados.usuario.nome}</h3>
        <p>Passe estes dados para a pessoa. A senha não será mostrada de novo; se perder, gere outra.</p>
        <dl
          className="kv"
          style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)' }}
        >
          <dt>Login</dt>
          <dd style={{ fontWeight: 500 }}>{dados.usuario.email}</dd>
          <dt>Senha</dt>
          <dd
            data-testid="senha-provisoria"
            style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 600, letterSpacing: '0.06em' }}
          >
            {dados.senhaProvisoria}
          </dd>
        </dl>
        <div className="dialog-actions">
          <Button icon={copiado ? 'check' : undefined} onClick={copiar}>
            {copiado ? 'Copiada' : 'Copiar senha'}
          </Button>
          <Button variant="primary" onClick={fechar} data-autofocus>
            Concluir
          </Button>
        </div>
      </div>
    </div>
  )
}
