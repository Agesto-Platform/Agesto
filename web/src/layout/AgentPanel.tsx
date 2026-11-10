import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Mascote, type MascoteApi } from '../components/Mascote'
import { api, ApiError } from '../lib/api'
import { periodRange } from '../lib/period'
import type { AgenteMensagem, AgentePerguntaRequest, AgenteResposta } from '../types/api'
import type { Period } from './PeriodSwitch'
import { saudacao, useConta } from './useConta'

const CHIPS: [IconName, string][] = [
  ['coins', 'Quanto sobrou este mês?'],
  ['trend', 'Qual serviço dá mais margem?'],
  ['file', 'Montar um orçamento'],
  ['calendar', 'O que tenho amanhã?'],
  ['alert', 'O que está acabando?'],
]

/** Quantas falas anteriores vão junto com a pergunta (a API aceita até 10). */
const HISTORICO_MAX = 10

/**
 * Painel do Agente: conversa com a IA (POST /api/agente/perguntar) sobre os
 * números do período escolhido no topo e a agenda dos próximos dias. A
 * conversa vive só aqui no navegador; a API não guarda histórico.
 */
export function AgentPanel({
  period,
  onClose,
  onMascote,
}: {
  period: Period
  onClose: () => void
  /** Recebe o mascote do painel (a abertura pós-login faz ele piscar ao pousar). */
  onMascote?: (api: MascoteApi | null) => void
}) {
  const conta = useConta()
  const [texto, setTexto] = useState('')
  const [mensagens, setMensagens] = useState<AgenteMensagem[]>([])
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const askRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const local = useRef<MascoteApi | null>(null)

  // o mesmo mascote atende a abertura e as reações do painel
  const setMascote = (api: MascoteApi | null) => {
    local.current = api
    onMascote?.(api)
  }

  // a conversa rola até a fala mais nova
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensagens, pensando, erro])

  const perguntar = async (bruta: string) => {
    const pergunta = bruta.trim()
    if (!pergunta || pensando) return

    const historico = mensagens.slice(-HISTORICO_MAX)
    setMensagens([...mensagens, { papel: 'usuario', texto: pergunta }])
    setTexto('')
    setErro(null)
    setPensando(true)
    local.current?.face('dot', 1200)

    try {
      const { de, ate } = periodRange(period)
      const corpo: AgentePerguntaRequest = { pergunta, historico, de, ate }
      const r = await api.post<AgenteResposta>('/api/agente/perguntar', corpo)
      setMensagens((atual) => [...atual, { papel: 'agente', texto: r.resposta }])
      local.current?.face('happy', 1200)
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não consegui falar com o Agente. Tente de novo.')
      local.current?.face('surprised', 900)
    } finally {
      setPensando(false)
    }
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    void perguntar(texto)
  }

  // Enter envia; Shift+Enter quebra a linha
  const teclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void perguntar(texto)
    }
  }

  const novaConversa = () => {
    setMensagens([])
    setErro(null)
    askRef.current?.focus()
  }

  const conversando = mensagens.length > 0

  return (
    <aside className="agent" aria-label="Agente">
      <div className="agent-inner">
        <div className="agent-head">
          <b>Agente</b>
          <span className="badge future">Prévia</span>
          <span className="end">
            {conversando && (
              <button className="icon-btn" type="button" onClick={novaConversa} aria-label="Nova conversa" disabled={pensando}>
                <Icon name="plus" />
              </button>
            )}
            <button className="icon-btn" type="button" onClick={onClose} aria-label="Fechar o Agente">
              <Icon name="x" />
            </button>
          </span>
        </div>
        <div className={conversando ? 'agent-body chat' : 'agent-body'} ref={bodyRef}>
          <div className="orb mascot">
            <Mascote ref={setMascote} />
          </div>
          {!conversando && (
            <>
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
                    disabled={pensando}
                    onMouseEnter={() => local.current?.face('happy', 900)}
                    onClick={() => void perguntar(txt)}
                  >
                    <Icon name={ic} />
                    {txt}
                  </button>
                ))}
              </div>
            </>
          )}
          {conversando && (
            <ol className="agent-msgs" aria-live="polite">
              {mensagens.map((m, i) => (
                <li key={i} className={`msg ${m.papel}`}>
                  <span className="sr-only">{m.papel === 'usuario' ? 'Você:' : 'Agente:'}</span>
                  {m.texto}
                </li>
              ))}
              {pensando && (
                <li className="msg agente pensando" aria-label="O Agente está pensando">
                  <span />
                  <span />
                  <span />
                </li>
              )}
            </ol>
          )}
          {erro && (
            <p className="agent-erro" role="alert">
              {erro}
            </p>
          )}
          <p className="agent-note">Respostas da IA com base nos números do sistema. Confira antes de decidir.</p>
        </div>
        <form className="composer" onSubmit={enviar}>
          <label className="sr-only" htmlFor="ask">
            Pergunta para o Agente
          </label>
          <textarea
            id="ask"
            ref={askRef}
            rows={2}
            maxLength={500}
            placeholder="Como posso ajudar hoje?"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={teclar}
            onFocus={() => {
              const r = askRef.current?.getBoundingClientRect()
              if (r) local.current?.lookAt(r.left + 40, r.top + 20).face('dot', 600)
            }}
            onBlur={() => local.current?.free()}
          />
          <div className="row">
            <span>Enter para enviar</span>
            <button className="send" type="submit" aria-label="Enviar" disabled={pensando || !texto.trim()}>
              <Icon name="arrowUp" />
            </button>
          </div>
        </form>
      </div>
    </aside>
  )
}
