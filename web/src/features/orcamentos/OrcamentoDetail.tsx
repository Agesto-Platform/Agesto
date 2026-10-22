import { Fragment, useState } from 'react'
import { Badge, Button, CardHead, SelectField, brl } from '../../components/ui'
import { Icon, type IconName } from '../../components/Icon'
import { MES_LONGO, iniciais } from '../../lib/format'
import { itemLabel, numero } from './labels'
import { StatusOrcamentoPill } from './status'
import type { ItemOrcamento, Orcamento, Produto, Servico, StatusOrcamento } from '../../types/api'

const COBRANCA: Record<string, string> = { PorHora: 'Por hora', Empreitada: 'Empreitada' }
const ORDEM: StatusOrcamento[] = ['Rascunho', 'Enviado', 'Aprovado', 'Recusado']

function criadoEm(iso: string): string {
  const d = new Date(iso)
  return `Criado em ${d.getDate()} de ${MES_LONGO[d.getMonth()]} de ${d.getFullYear()}`
}

function tipoItem(it: ItemOrcamento): { icon: IconName; label: string } {
  if (it.servicoId != null) return { icon: 'hammer', label: 'Serviço' }
  if (it.produtoId != null) return { icon: 'box', label: 'Material' }
  return { icon: 'pencil', label: 'Avulso' }
}

/** Detalhe do orçamento selecionado (cartão da direita da tela). */
export function OrcamentoDetail({
  orcamento: o,
  clienteNome,
  produtos,
  servicos,
  onChangeStatus,
  onConvert,
  onEdit,
  busy,
}: {
  orcamento: Orcamento
  clienteNome: string
  produtos: Produto[]
  servicos: Servico[]
  onChangeStatus: (status: StatusOrcamento) => void
  onConvert: () => void
  onEdit: () => void
  busy: { status: boolean; convert: boolean }
}) {
  const convertido = o.atendimentoConvertidoId != null

  // Etapas: Rascunho → Enviado → Aprovado (ou Recusado) → Atendimento.
  const idx = convertido ? 4 : Math.min(ORDEM.indexOf(o.status), 2)
  const etapas = ['Rascunho', 'Enviado', o.status === 'Recusado' ? 'Recusado' : 'Aprovado', 'Atendimento']

  // Custo é por linha e opcional: só calcula a margem quando algum item tem custo.
  const temCusto = o.itens.some((i) => i.custo != null)
  const custo = o.itens.reduce((s, i) => s + (i.custo ?? 0), 0)

  return (
    <>
      <CardHead
        title={
          <>
            Orçamento {numero(o.id)} <StatusOrcamentoPill status={o.status} />
          </>
        }
        subtitle={criadoEm(o.dataRegistro)}
        action={
          <Button size="sm" icon="pencil" onClick={onEdit}>
            Editar
          </Button>
        }
      />
      <div style={{ padding: '14px 16px 0' }}>
        <div className="steps">
          {etapas.map((s, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="line" />}
              <span className={`s${i < idx ? ' done' : i === idx ? ' now' : ''}`}>
                <i>{i < idx ? '✓' : i + 1}</i>
                {s}
              </span>
            </Fragment>
          ))}
        </div>
      </div>
      <dl className="q-meta">
        <div>
          <dt>Cliente</dt>
          <dd>
            <span className="cell">
              <span className="avatar sm">{iniciais(clienteNome)}</span>
              {clienteNome}
            </span>
          </dd>
        </div>
        <div>
          <dt>Itens</dt>
          <dd>{o.itens.length}</dd>
        </div>
        <div>
          <dt>Validade</dt>
          <dd className="muted" style={{ fontWeight: 500 }} title="O orçamento ainda não tem data de validade no sistema">
            a definir
          </dd>
        </div>
      </dl>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Item</th>
              <th className="n">Qtd.</th>
              <th className="n">Preço un.</th>
              <th className="n">Custo</th>
              <th className="n">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {o.itens.map((it) => {
              const t = tipoItem(it)
              const cobranca =
                it.servicoId != null ? servicos.find((s) => s.id === it.servicoId)?.tipoCobranca : undefined
              return (
                <tr key={it.id}>
                  <td>
                    <div className="cell">
                      <span className="cell-ic">
                        <Icon name={t.icon} />
                      </span>
                      <span>
                        <span className="strong">{itemLabel(it, produtos, servicos)}</span>
                        <span className="sub">
                          {t.label}
                          {cobranca ? ' · ' + (COBRANCA[cobranca] ?? cobranca) : ''}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="n">{it.quantidade}</td>
                  <td className="n">{brl(it.precoUnitario, true)}</td>
                  <td className="n muted">{brl(it.custo, true)}</td>
                  <td className="n strong">{brl(it.subtotal, true)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="totals">
        <div>
          <span>Total</span>
          <b>{brl(o.valorTotal, true)}</b>
        </div>
        <div>
          <span>Custo</span>
          <b className={temCusto ? undefined : 'muted'}>{temCusto ? brl(custo, true) : '—'}</b>
        </div>
        <div className="grand">
          <span>Margem prevista</span>
          <b className={temCusto ? undefined : 'muted'}>{temCusto ? brl(o.valorTotal - custo, true) : 'preencha o custo'}</b>
        </div>
      </div>
      <div className="q-foot">
        {o.status === 'Rascunho' && (
          <Button variant="primary" icon="send" onClick={() => onChangeStatus('Enviado')} disabled={busy.status}>
            Marcar como enviado
          </Button>
        )}
        {o.status === 'Enviado' && (
          <>
            <Button variant="primary" icon="check" onClick={() => onChangeStatus('Aprovado')} disabled={busy.status}>
              Marcar como aprovado
            </Button>
            <Button icon="x" onClick={() => onChangeStatus('Recusado')} disabled={busy.status}>
              Recusado
            </Button>
          </>
        )}
        {o.status === 'Aprovado' && !convertido && (
          <Button variant="primary" icon="swap" onClick={onConvert} disabled={busy.convert}>
            {busy.convert ? 'Convertendo…' : 'Converter em atendimento'}
          </Button>
        )}
        {convertido && (
          <Badge tone="ok" icon="check">
            Convertido no atendimento #{o.atendimentoConvertidoId}
          </Badge>
        )}
        <Button variant="ghost" icon="whats" disabled title="Ainda não existe no sistema">
          Enviar por WhatsApp
        </Button>
        <Badge tone="future">Futuro</Badge>
      </div>
    </>
  )
}

/** Gaveta "Editar": o backend só muda o status (itens novos = novo orçamento). */
export function OrcamentoEditForm({
  orcamento,
  onSave,
  onDelete,
  onCancel,
  busy,
}: {
  orcamento: Orcamento
  onSave: (status: StatusOrcamento) => void
  onDelete: () => void
  onCancel: () => void
  busy: { status: boolean; delete: boolean }
}) {
  const [status, setStatus] = useState<StatusOrcamento>(orcamento.status)
  const convertido = orcamento.atendimentoConvertidoId != null

  return (
    <>
      <div className="form">
        {convertido ? (
          <p className="hint" style={{ margin: 0 }}>
            Este orçamento já virou o atendimento #{orcamento.atendimentoConvertidoId}; o status não muda mais.
          </p>
        ) : (
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            hint="Para mudar os itens, crie um novo orçamento."
            options={ORDEM.map((s) => ({ value: s, label: s }))}
          />
        )}
        {!convertido && orcamento.status !== 'Aprovado' && (
          <p className="hint" style={{ margin: 0 }}>
            Só orçamentos aprovados podem ser convertidos em atendimento.
          </p>
        )}
      </div>
      <div className="form-actions">
        <Button
          variant="ghost"
          onClick={onDelete}
          disabled={busy.delete}
          style={{ marginRight: 'auto', color: 'var(--neg-ink)' }}
        >
          {busy.delete ? 'Excluindo…' : 'Excluir orçamento'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={() => onSave(status)}
          disabled={convertido || busy.status || status === orcamento.status}
        >
          {busy.status ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </>
  )
}
