import { useState } from 'react'
import { Button } from '../../components/ui'
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
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/30" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="senha-provisoria-titulo"
        className="relative w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-card"
      >
        <h3 id="senha-provisoria-titulo" className="text-[15px] font-semibold text-ink">
          Senha provisória de {dados.usuario.nome}
        </h3>
        <p className="mt-1.5 text-[13px] text-ink-3">
          Passe estes dados para a pessoa. A senha não será mostrada de novo; se perder, gere outra.
        </p>
        <dl className="mt-4 flex flex-col gap-2 rounded-[10px] bg-surface-2 px-3 py-3 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Login</dt>
            <dd className="font-medium text-ink">{dados.usuario.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Senha</dt>
            <dd className="font-mono text-[14px] font-semibold tracking-wider text-ink" data-testid="senha-provisoria">
              {dados.senhaProvisoria}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={copiar}>
            {copiado ? 'Copiada' : 'Copiar senha'}
          </Button>
          <Button onClick={onClose}>Concluir</Button>
        </div>
      </div>
    </div>
  )
}
