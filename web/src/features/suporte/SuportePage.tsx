import { useId, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { Badge, Button, DataTable, Drawer, PageHead, SelectField, useToast, type Column } from '../../components/ui'
import { ApiError } from '../../lib/api'
import { dataCurta, hora } from '../../lib/format'
import type { AssuntoTicket, Ticket } from '../../types/api'
import { useCriarTicket, useTicket, useTickets } from './queries'
import { ASSUNTOS, MENSAGEM_MAX, MENSAGEM_MIN, rotuloAssunto, statusInfo } from './rotulos'
import { ACEITOS, MAX_ANEXOS, MAX_BYTES, comprimir, motivoRecusa, tamanhoLegivel } from './anexos'
import { Icon } from '../../components/Icon'
import { TicketConversa } from './TicketConversa'
import './suporte.css'

const COLUNAS: Column<Ticket>[] = [
  {
    header: 'Chamado',
    cell: (t) => (
      <div className="ticket-resumo">
        <b>
          #{t.id} · {rotuloAssunto(t.assunto)}
        </b>
        <span>{t.mensagem}</span>
      </div>
    ),
  },
  {
    header: 'Situação',
    cell: (t) => {
      const st = statusInfo(t.status)
      return (
        <Badge tone={st.tone} dot>
          {st.label}
        </Badge>
      )
    },
  },
  {
    header: 'Anexos',
    cell: (t) => (t.totalAnexos ? <span title={`${t.totalAnexos} anexo(s)`}>📎 {t.totalAnexos}</span> : '—'),
    align: 'right',
  },
  { header: 'Respostas', cell: (t) => t.totalRespostas, align: 'right' },
  { header: 'Atualizado', cell: (t) => `${dataCurta(t.updatedAt)} · ${hora(t.updatedAt)}` },
]

/** Formulário do chamado novo: assunto e mensagem. */
function NovoChamado({ onCriado, onCancel }: { onCriado: (t: Ticket) => void; onCancel: () => void }) {
  const criar = useCriarTicket()
  const msgId = useId()
  const [assunto, setAssunto] = useState<AssuntoTicket>('Duvida')
  const [mensagem, setMensagem] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [preparando, setPreparando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inputArquivos = useRef<HTMLInputElement>(null)

  // Imagens são reduzidas e regravadas antes de entrar na lista (menos espaço e envio mais rápido).
  async function adicionar(novos: File[]) {
    if (novos.length === 0) return
    const vagas = MAX_ANEXOS - anexos.length
    if (vagas <= 0) return setErro(`Anexe no máximo ${MAX_ANEXOS} arquivos.`)
    const recusa = novos.map(motivoRecusa).find(Boolean)
    if (recusa) return setErro(recusa)
    setErro(null)
    setPreparando(true)
    try {
      const prontos = await Promise.all(novos.slice(0, vagas).map(comprimir))
      const grande = prontos.find((f) => f.size > MAX_BYTES)
      if (grande) return setErro(`${grande.name} passa de 5 MB mesmo depois de reduzido.`)
      setAnexos((atual) => [...atual, ...prontos].slice(0, MAX_ANEXOS))
      if (novos.length > vagas) setErro(`Só cabem ${MAX_ANEXOS} anexos; os demais ficaram de fora.`)
    } finally {
      setPreparando(false)
    }
  }

  // Ctrl+V de um print direto na mensagem.
  function colar(ev: ClipboardEvent<HTMLTextAreaElement>) {
    const imagens = [...ev.clipboardData.files].filter((f) => f.type.startsWith('image/'))
    if (imagens.length === 0) return
    ev.preventDefault()
    void adicionar(imagens.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `print-${Date.now()}-${i}.png`, { type: f.type }))))
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    const texto = mensagem.trim()
    if (texto.length < MENSAGEM_MIN) return setErro(`Escreva pelo menos ${MENSAGEM_MIN} caracteres.`)
    setErro(null)
    criar.mutate(
      { assunto, mensagem: texto, anexos },
      {
        onSuccess: onCriado,
        onError: (e) => setErro(e instanceof ApiError ? e.message : 'Não foi possível abrir o chamado.'),
      },
    )
  }

  return (
    <form onSubmit={enviar}>
      <div className="form ticket-form">
        {erro && (
          <p className="form-error" role="alert">
            {erro}
          </p>
        )}
        <SelectField<AssuntoTicket> label="Assunto" value={assunto} onChange={setAssunto} options={ASSUNTOS} required />
        <div className="field">
          <label htmlFor={msgId}>
            Mensagem<span className="req"> *</span>
          </label>
          <textarea
            id={msgId}
            className="textarea"
            rows={7}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            onPaste={colar}
            maxLength={MENSAGEM_MAX}
            placeholder="Conte o que aconteceu ou o que você precisa. Se for um problema, diga em qual tela e o que esperava ver."
          />
          <span className="contador">
            {mensagem.length}/{MENSAGEM_MAX}
          </span>
        </div>
        <div className="field">
          <span className="section-label">Anexos (opcional)</span>
          <span className="hint">
            Até {MAX_ANEXOS} arquivos: imagens (PNG, JPG, WEBP) ou PDF de até 5 MB. Para um print, cole na mensagem com
            Ctrl+V. As imagens são reduzidas antes de enviar.
          </span>
          {anexos.length > 0 && (
            <ul className="ticket-anexos-lista" aria-label="Anexos escolhidos">
              {anexos.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <Icon name={f.type === 'application/pdf' ? 'file' : 'eye'} className="sm" />
                  <span>{f.name}</span>
                  <span className="muted">{tamanhoLegivel(f.size)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAnexos((atual) => atual.filter((_, j) => j !== i))}
                    aria-label={`Tirar ${f.name}`}
                  >
                    Tirar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputArquivos}
            type="file"
            accept={ACEITOS}
            multiple
            hidden
            aria-label="Escolher arquivos"
            onChange={(e) => {
              void adicionar([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
          <div>
            <Button
              size="sm"
              icon="plus"
              onClick={() => inputArquivos.current?.click()}
              disabled={preparando || anexos.length >= MAX_ANEXOS}
            >
              {preparando ? 'Preparando…' : 'Anexar arquivo'}
            </Button>
          </div>
        </div>
        <p className="hint" style={{ margin: 0 }}>
          O chamado vai para a equipe do Agesto, e você recebe uma cópia no seu email. A resposta aparece aqui e também
          chega por email.
        </p>
      </div>
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={criar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon="send" disabled={criar.isPending || preparando}>
          {criar.isPending ? 'Enviando…' : 'Enviar chamado'}
        </Button>
      </div>
    </form>
  )
}

/** Aba Suporte do Dono (DEC-60): abre chamados e acompanha a resposta da equipe. */
export function SuportePage() {
  const lista = useTickets()
  const toast = useToast()
  const [novo, setNovo] = useState(false)
  const [abertoId, setAbertoId] = useState<number | null>(null)
  const detalhe = useTicket(abertoId)

  return (
    <>
      <PageHead
        title="Suporte"
        sub="Fale com a equipe do Agesto: tire dúvidas, avise de um problema ou sugira uma melhoria. Acompanhe aqui a resposta de cada chamado."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setNovo(true)}>
            Novo chamado
          </Button>
        }
      />

      <section className="card">
        {lista.isError && (
          <p className="form-error" role="alert" style={{ margin: 16 }}>
            Não foi possível carregar os chamados{lista.error instanceof ApiError ? `: ${lista.error.message}` : '.'}
          </p>
        )}
        <DataTable
          columns={COLUNAS}
          rows={lista.data}
          getKey={(t) => t.id}
          loading={lista.isLoading}
          onRowClick={(t) => setAbertoId(t.id)}
          isSelected={(t) => t.id === abertoId}
          empty={{
            title: 'Nenhum chamado aberto',
            text: 'Quando precisar da equipe do Agesto, use "Novo chamado".',
            icon: 'help',
          }}
        />
      </section>

      <Drawer open={novo} onClose={() => setNovo(false)} title="Novo chamado">
        {novo && (
          <NovoChamado
            onCancel={() => setNovo(false)}
            onCriado={(t) => {
              setNovo(false)
              setAbertoId(t.id)
              toast.success(`Chamado #${t.id} aberto. Enviamos uma cópia para o seu email.`)
            }}
          />
        )}
      </Drawer>

      <Drawer
        open={abertoId !== null}
        onClose={() => setAbertoId(null)}
        title={abertoId !== null ? `Chamado #${abertoId}` : 'Chamado'}
      >
        {detalhe.data ? (
          <TicketConversa ticket={detalhe.data} />
        ) : (
          <p className="hint">{detalhe.isError ? 'Não foi possível abrir o chamado.' : 'Carregando…'}</p>
        )}
      </Drawer>
    </>
  )
}
