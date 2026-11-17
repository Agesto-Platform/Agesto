import { Badge } from '../../components/ui'
import { dataCurta, hora } from '../../lib/format'
import type { Ticket } from '../../types/api'
import { rotuloAssunto, statusInfo } from './rotulos'
import { ehImagem, tamanhoLegivel } from './anexos'
import './suporte.css'

const quando = (iso: string) => `${dataCurta(iso)} · ${hora(iso)}`

/**
 * Mensagem do Dono e respostas da equipe, em ordem (DEC-60). Usado na aba
 * Suporte do painel e no superadmin.
 */
export function TicketConversa({ ticket, autorDono = 'Você' }: { ticket: Ticket; autorDono?: string }) {
  const st = statusInfo(ticket.status)
  return (
    <div className="ticket">
      <div className="ticket-meta">
        <Badge tone={st.tone} dot>
          {st.label}
        </Badge>
        <span>{rotuloAssunto(ticket.assunto)}</span>
        <span className="muted">Aberto em {quando(ticket.createdAt)}</span>
        {ticket.resolvidoEm && <span className="muted">Resolvido em {quando(ticket.resolvidoEm)}</span>}
      </div>
      <ol className="ticket-msgs" aria-label="Mensagens do chamado">
        <li className="ticket-msg dono">
          <div className="ticket-msg-head">
            <b>{autorDono}</b>
            <span>{quando(ticket.createdAt)}</span>
          </div>
          <p>{ticket.mensagem}</p>
          {(ticket.anexos ?? []).length > 0 && (
            <ul className="ticket-anexos" aria-label="Anexos do chamado">
              {(ticket.anexos ?? []).map((a) => (
                <li key={a.id}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" title={`Abrir ${a.nomeArquivo}`}>
                      {ehImagem(a.contentType) ? (
                        <img src={a.url} alt={a.nomeArquivo} loading="lazy" />
                      ) : (
                        <span className="ticket-pdf">PDF</span>
                      )}
                      <span>{a.nomeArquivo}</span>
                    </a>
                  ) : (
                    <span className="muted">{a.nomeArquivo} (indisponível agora)</span>
                  )}
                  <span className="muted">{tamanhoLegivel(a.tamanho)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
        {(ticket.respostas ?? []).map((r) => (
          <li key={r.id} className="ticket-msg equipe">
            <div className="ticket-msg-head">
              <b>{r.autor === 'Equipe Agesto' ? r.autor : `${r.autor} · Equipe Agesto`}</b>
              <span>{quando(r.createdAt)}</span>
            </div>
            <p>{r.mensagem}</p>
          </li>
        ))}
      </ol>
      {(ticket.respostas ?? []).length === 0 && (
        <p className="hint" style={{ margin: 0 }}>
          Ainda sem resposta da equipe.
        </p>
      )}
    </div>
  )
}
