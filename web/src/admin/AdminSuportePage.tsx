import { useId, useState, type FormEvent } from 'react'
import { Badge, Button, DataTable, Drawer, PageHead, Seg, SelectField, useToast, type Column } from '../components/ui'
import { ApiError } from '../lib/api'
import { dataCurta, hora } from '../lib/format'
import type { StatusTicket, Ticket } from '../types/api'
import { MENSAGEM_MAX, STATUS, rotuloAssunto, statusInfo } from '../features/suporte/rotulos'
import { TicketConversa } from '../features/suporte/TicketConversa'
import { useMudarStatusTicket, useResponderTicket, useTicketAdmin, useTicketsAdmin } from './queries'

type Filtro = 'todos' | StatusTicket

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
    header: 'Empresa',
    cell: (t) => (
      <div className="adm-cell">
        <b>{t.empresaNome}</b>
        <span>
          {t.donoNome} · {t.donoEmail}
        </span>
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
  { header: 'Respostas', cell: (t) => t.totalRespostas, align: 'right' },
  { header: 'Atualizado', cell: (t) => `${dataCurta(t.updatedAt)} · ${hora(t.updatedAt)}` },
]

/** Resposta da equipe, com a opção de já mudar o status. */
function Responder({ ticket }: { ticket: Ticket }) {
  const responder = useResponderTicket()
  const mudar = useMudarStatusTicket()
  const toast = useToast()
  const msgId = useId()
  const [mensagem, setMensagem] = useState('')
  // Responder um chamado aberto já o coloca em andamento (a API faz o mesmo).
  const [status, setStatus] = useState<StatusTicket>(ticket.status === 'Aberto' ? 'EmAndamento' : ticket.status)
  const [erro, setErro] = useState<string | null>(null)
  const ocupado = responder.isPending || mudar.isPending
  const falha = (e: unknown, padrao: string) => setErro(e instanceof ApiError ? e.message : padrao)

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    if (mensagem.trim().length < 2) return setErro('Escreva a resposta.')
    setErro(null)
    responder.mutate(
      { id: ticket.id, mensagem: mensagem.trim(), status },
      {
        onSuccess: () => {
          setMensagem('')
          toast.success(`Resposta enviada. ${ticket.donoNome ?? 'O Dono'} recebe um email.`)
        },
        onError: (e) => falha(e, 'Não foi possível enviar a resposta.'),
      },
    )
  }

  function soStatus(novo: StatusTicket) {
    setErro(null)
    mudar.mutate(
      { id: ticket.id, status: novo },
      {
        onSuccess: () => toast.success(`Chamado #${ticket.id}: ${statusInfo(novo).label}.`),
        onError: (e) => falha(e, 'Não foi possível mudar o status.'),
      },
    )
  }

  return (
    <form onSubmit={enviar} className="ticket-form" style={{ marginTop: 18 }}>
      {erro && (
        <p className="form-error" role="alert">
          {erro}
        </p>
      )}
      <div className="field">
        <label htmlFor={msgId}>Responder ao Dono</label>
        <textarea
          id={msgId}
          className="textarea"
          rows={5}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          maxLength={MENSAGEM_MAX}
        />
      </div>
      <SelectField<StatusTicket> label="Status depois da resposta" value={status} onChange={setStatus} options={STATUS} />
      <div className="form-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS.filter((s) => s.value !== ticket.status).map((s) => (
            <Button key={s.value} size="sm" variant="ghost" disabled={ocupado} onClick={() => soStatus(s.value)}>
              Marcar {s.label.toLowerCase()}
            </Button>
          ))}
        </div>
        <Button type="submit" variant="primary" icon="send" disabled={ocupado}>
          {responder.isPending ? 'Enviando…' : 'Enviar resposta'}
        </Button>
      </div>
    </form>
  )
}

/** Chamados de suporte dos Donos (DEC-60): a equipe lê, responde e avança o status. */
export function AdminSuportePage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const lista = useTicketsAdmin(filtro === 'todos' ? undefined : filtro)
  const [abertoId, setAbertoId] = useState<number | null>(null)
  const detalhe = useTicketAdmin(abertoId)
  const abertos = (lista.data ?? []).filter((t) => t.status === 'Aberto').length

  return (
    <>
      <PageHead
        title="Suporte"
        badge={filtro === 'todos' && abertos > 0 ? <Badge tone="warn">{abertos} abertos</Badge> : undefined}
        sub="Chamados abertos pelos Donos na aba Suporte do painel. Cada resposta vai por email para o Dono."
      />
      <section className="card">
        <div className="toolbar">
          <Seg<Filtro>
            label="Situação"
            value={filtro}
            onChange={setFiltro}
            options={[{ value: 'todos', label: 'Todos' }, ...STATUS.map((s) => ({ value: s.value, label: s.label }))]}
          />
        </div>
        <DataTable
          columns={COLUNAS}
          rows={lista.data}
          getKey={(t) => t.id}
          loading={lista.isLoading}
          onRowClick={(t) => setAbertoId(t.id)}
          isSelected={(t) => t.id === abertoId}
          empty={{ title: 'Nenhum chamado', text: 'Os chamados que os Donos abrirem aparecem aqui.', icon: 'help' }}
        />
      </section>

      <Drawer
        open={abertoId !== null}
        onClose={() => setAbertoId(null)}
        title={abertoId !== null ? `Chamado #${abertoId}` : 'Chamado'}
        sub={detalhe.data ? `${detalhe.data.empresaNome} · ${detalhe.data.donoNome} (${detalhe.data.donoEmail})` : undefined}
      >
        {detalhe.data ? (
          <>
            <TicketConversa ticket={detalhe.data} autorDono={detalhe.data.donoNome ?? 'Dono'} />
            <Responder key={`${detalhe.data.id}-${detalhe.data.status}`} ticket={detalhe.data} />
          </>
        ) : (
          <p className="hint">{detalhe.isError ? 'Não foi possível abrir o chamado.' : 'Carregando…'}</p>
        )}
      </Drawer>
    </>
  )
}
