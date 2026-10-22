import { useRef, useState, type FormEvent } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Mascote, type MascoteApi } from '../components/Mascote'
import { saudacao, useConta } from './useConta'

const CHIPS: [IconName, string][] = [
  ['coins', 'Quanto sobrou este mês?'],
  ['trend', 'Qual serviço dá mais margem?'],
  ['file', 'Montar um orçamento'],
  ['calendar', 'O que tenho amanhã?'],
  ['alert', 'O que está acabando?'],
]

/**
 * Painel do Agente (IA planejada, ainda sem backend): mascote, atalhos de
 * pergunta e o campo de escrita. Marcado como "Prévia", igual ao template.
 */
export function AgentPanel({
  onClose,
  onMascote,
}: {
  onClose: () => void
  /** Recebe o mascote do painel (a abertura pós-login faz ele piscar ao pousar). */
  onMascote?: (api: MascoteApi | null) => void
}) {
  const conta = useConta()
  const [texto, setTexto] = useState('')
  const askRef = useRef<HTMLTextAreaElement>(null)
  const local = useRef<MascoteApi | null>(null)

  // o mesmo mascote atende a abertura e as reações do painel
  const setMascote = (api: MascoteApi | null) => {
    local.current = api
    onMascote?.(api)
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
  }

  return (
    <aside className="agent" aria-label="Agente">
      <div className="agent-inner">
        <div className="agent-head">
          <b>Agente</b>
          <span className="badge future">Prévia</span>
          <span className="end">
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Fechar o Agente">
              <Icon name="x" />
            </button>
          </span>
        </div>
        <div className="agent-body">
          <div className="orb mascot">
            <Mascote ref={setMascote} />
          </div>
          <p className="agent-hello">
            {saudacao()}, {conta.nome}
          </p>
          <p className="agent-text">Pergunte sobre o seu negócio: dinheiro, agenda, orçamentos e estoque.</p>
          <div className="chips">
            {CHIPS.map(([ic, txt]) => (
              <button
                key={txt}
                className="chip"
                type="button"
                onMouseEnter={() => local.current?.face('happy', 900)}
                onClick={() => {
                  setTexto(txt)
                  askRef.current?.focus()
                }}
              >
                <Icon name={ic} />
                {txt}
              </button>
            ))}
          </div>
          <p className="agent-note">IA planejada: ela vai só interpretar os números que o sistema já calculou.</p>
        </div>
        <form className="composer" onSubmit={enviar}>
          <label className="sr-only" htmlFor="ask">
            Pergunta para o Agente
          </label>
          <textarea
            id="ask"
            ref={askRef}
            rows={2}
            placeholder="Como posso ajudar hoje?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => {
              const r = askRef.current?.getBoundingClientRect()
              if (r) local.current?.lookAt(r.left + 40, r.top + 20).face('dot', 600)
            }}
            onBlur={() => local.current?.free()}
          />
          <div className="row">
            <span>Enter para enviar</span>
            <button className="send" type="submit" aria-label="Enviar">
              <Icon name="arrowUp" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  )
}
