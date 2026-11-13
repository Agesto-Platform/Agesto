import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, CardBody, CardHead, ConfirmDialog, Drawer, SelectField, TextField, useToast } from '../components/ui'
import { ApiError } from '../lib/api'
import { FORMAS, SITUACAO, dataBr, reais, rotuloForma, vencimentoTexto } from '../lib/assinatura'
import type { Assinatura, FormaPagamento, PagamentoAssinatura } from '../types/api'
import { useAtualizarAssinatura, useDesfazerPagamento, useRegistrarPagamento } from './queries'

const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MESES = [1, 2, 3, 6, 12].map((m) => ({ value: String(m), label: m === 1 ? '1 mês' : `${m} meses` }))

/**
 * Bloco Assinatura da empresa no superadmin (DEC-58): situação, licenças,
 * valor, histórico de pagamentos, registrar pagamento e ajustar a assinatura.
 */
export function AssinaturaAdminCard({ empresaId, assinatura: a }: { empresaId: number; assinatura: Assinatura }) {
  const toast = useToast()
  const registrar = useRegistrarPagamento(empresaId)
  const atualizar = useAtualizarAssinatura(empresaId)
  const desfazer = useDesfazerPagamento(empresaId)
  const [aDesfazer, setADesfazer] = useState<PagamentoAssinatura | null>(null)

  const [pagando, setPagando] = useState(false)
  const [pagamento, setPagamento] = useState({ valor: '', pagoEm: hojeIso(), forma: 'Pix' as FormaPagamento, meses: '1', observacao: '' })
  const [editando, setEditando] = useState(false)
  const [ajuste, setAjuste] = useState({ licencas: String(a.licencasFuncionarios), pagoAte: a.pagoAte ?? '' })
  const [erro, setErro] = useState<string | null>(null)

  const situacao = SITUACAO[a.situacao]
  const abrirPagamento = () => {
    setErro(null)
    setPagamento({ valor: a.valorMensal.toFixed(2).replace('.', ','), pagoEm: hojeIso(), forma: 'Pix', meses: '1', observacao: '' })
    setPagando(true)
  }
  const abrirAjuste = () => {
    setErro(null)
    setAjuste({ licencas: String(a.licencasFuncionarios), pagoAte: a.pagoAte ?? '' })
    setEditando(true)
  }

  const salvarPagamento = async (ev: FormEvent) => {
    ev.preventDefault()
    const meses = Number(pagamento.meses)
    const valor = Number(pagamento.valor.replace(/\./g, '').replace(',', '.'))
    if (!(valor > 0) || !pagamento.pagoEm) {
      setErro('Informe o valor e a data do pagamento.')
      return
    }
    setErro(null)
    try {
      const r = await registrar.mutateAsync({
        valor,
        pagoEm: pagamento.pagoEm,
        forma: pagamento.forma,
        meses,
        observacao: pagamento.observacao.trim() || null,
      })
      setPagando(false)
      toast.success(`Pagamento registrado. Pago até ${dataBr(r.pagoAte)}.${!a.ativa && r.ativa ? ' A empresa foi desbloqueada.' : ''}`)
    } catch (err) {
      setErro(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível registrar o pagamento.')
    }
  }

  const confirmarDesfazer = async () => {
    if (!aDesfazer) return
    try {
      const r = await desfazer.mutateAsync(aDesfazer.id)
      setADesfazer(null)
      toast.success(r.pagoAte ? `Pagamento desfeito. Pago até ${dataBr(r.pagoAte)}.` : 'Pagamento desfeito. A empresa voltou para "sem cobrança".')
    } catch (err) {
      setADesfazer(null)
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível desfazer o pagamento.')
    }
  }

  const salvarAjuste = async (ev: FormEvent) => {
    ev.preventDefault()
    const licencas = Number(ajuste.licencas)
    if (!Number.isInteger(licencas) || licencas < 1) {
      setErro('Licenças de funcionário: pelo menos 1.')
      return
    }
    setErro(null)
    try {
      await atualizar.mutateAsync({ licencasFuncionarios: licencas, pagoAte: ajuste.pagoAte || null })
      setEditando(false)
      toast.success('Assinatura atualizada.')
    } catch (err) {
      setErro(err instanceof ApiError ? [err.message, ...err.errors].join(' ') : 'Não foi possível atualizar a assinatura.')
    }
  }

  return (
    <Card className="adm-bloco">
      <CardHead
        title={
          <>
            Assinatura{' '}
            <Badge tone={situacao.tone} dot>
              {situacao.label}
            </Badge>
          </>
        }
        subtitle={`${vencimentoTexto(a)}${a.diasParaBloqueio ? ` · bloqueio automático em ${a.diasParaBloqueio} dia(s)` : ''}`}
        action={
          <div className="adm-acoes">
            <Button size="sm" onClick={abrirAjuste}>
              Ajustar
            </Button>
            <Button size="sm" variant="primary" icon="plus" onClick={abrirPagamento}>
              Registrar pagamento
            </Button>
          </div>
        }
      />
      <CardBody>
        <div className="adm-assinatura">
          <div>
            <span>Valor mensal</span>
            <b>{reais(a.valorMensal)}</b>
          </div>
          <div>
            <span>Licenças de funcionário</span>
            <b>{a.licencasFuncionarios}</b>
          </div>
          <div>
            <span>Acessos em uso</span>
            <b className={a.acessosEmUso > a.acessosPermitidos ? 'neg' : undefined}>
              {a.acessosEmUso} de {a.acessosPermitidos}
            </b>
          </div>
        </div>
        {a.pagamentos.length > 0 ? (
          <table className="t adm-pagamentos">
            <thead>
              <tr>
                <th>Pago em</th>
                <th>Período</th>
                <th>Forma</th>
                <th className="n">Valor</th>
                <th>Registrado por</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {a.pagamentos.map((p) => (
                <tr key={p.id} className={p.desfeitoEm ? 'desfeito' : undefined}>
                  <td>{dataBr(p.pagoEm)}</td>
                  <td>
                    {dataBr(p.periodoInicio)} a {dataBr(p.periodoFim)}
                    {p.observacao && <span className="sub">{p.observacao}</span>}
                  </td>
                  <td>{rotuloForma(p.forma)}</td>
                  <td className="n">{reais(p.valor)}</td>
                  <td>
                    {p.adminNome ?? '—'}
                    {p.desfeitoEm && <span className="sub">Desfeito{p.desfeitoPor ? ` por ${p.desfeitoPor}` : ''}</span>}
                  </td>
                  <td className="n">
                    {p.podeDesfazer && (
                      <Button size="sm" variant="ghost" onClick={() => setADesfazer(p)}>
                        Desfazer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted adm-sem-pagamentos">
            Nenhum pagamento registrado.{!a.pagoAte && ' Sem "pago até", a empresa não é bloqueada por atraso.'}
          </p>
        )}
      </CardBody>

      <ConfirmDialog
        open={aDesfazer !== null}
        title="Desfazer este pagamento?"
        message={
          aDesfazer
            ? `O pagamento de ${reais(aDesfazer.valor)} de ${dataBr(aDesfazer.pagoEm)} fica no histórico como desfeito, e o "pago até" volta para ${
                aDesfazer.periodoInicio ? dataBr(diaAnterior(aDesfazer.periodoInicio)) : 'o de antes'
              } (ou "sem cobrança", se era o primeiro). Se a empresa ficar com mais de 10 dias de atraso, a rotina a bloqueia de novo.`
            : ''
        }
        confirmLabel="Desfazer"
        loading={desfazer.isPending}
        onConfirm={confirmarDesfazer}
        onCancel={() => setADesfazer(null)}
      />

      <Drawer
        open={pagando}
        onClose={() => setPagando(false)}
        title="Registrar pagamento"
        sub={a.pagoAte ? `O período começa em ${dataBr(diaSeguinte(a.pagoAte))}, logo depois do último pago.` : 'Sem histórico: o período começa hoje.'}
      >
        <form className="form" onSubmit={salvarPagamento} noValidate>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField label="Valor (R$)" value={pagamento.valor} onChange={(v) => setPagamento((p) => ({ ...p, valor: v }))} inputMode="decimal" required />
          <TextField label="Pago em" type="date" value={pagamento.pagoEm} onChange={(v) => setPagamento((p) => ({ ...p, pagoEm: v }))} required />
          <SelectField<FormaPagamento> label="Forma" value={pagamento.forma} onChange={(v) => setPagamento((p) => ({ ...p, forma: v }))} options={FORMAS} />
          <SelectField<string> label="Cobre" value={pagamento.meses} onChange={(v) => setPagamento((p) => ({ ...p, meses: v }))} options={MESES} />
          <TextField label="Observação" value={pagamento.observacao} onChange={(v) => setPagamento((p) => ({ ...p, observacao: v }))} maxLength={300} placeholder="Ex.: Pix do dia 10, comprovante no WhatsApp" />
          <div className="form-actions">
            <Button type="button" onClick={() => setPagando(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar'}
            </Button>
          </div>
        </form>
      </Drawer>

      <Drawer open={editando} onClose={() => setEditando(false)} title="Ajustar assinatura" sub="Licenças a mais custam R$ 19,90/mês cada. O ajuste fica na auditoria.">
        <form className="form" onSubmit={salvarAjuste} noValidate>
          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}
          <TextField
            label="Licenças de funcionário (1 inclusa)"
            value={ajuste.licencas}
            onChange={(v) => setAjuste((x) => ({ ...x, licencas: v.replace(/\D/g, '') }))}
            inputMode="numeric"
            hint={`Valor mensal: ${reais(49.9 + Math.max(0, (Number(ajuste.licencas) || 1) - 1) * 19.9)}`}
            required
          />
          <TextField
            label="Pago até"
            type="date"
            value={ajuste.pagoAte}
            onChange={(v) => setAjuste((x) => ({ ...x, pagoAte: v }))}
            hint="Para um mês de cortesia ou corrigir um lançamento. Vazio = sem cobrança (nunca bloqueia por atraso)."
          />
          <div className="form-actions">
            <Button type="button" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={atualizar.isPending}>
              {atualizar.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Drawer>
    </Card>
  )
}

function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10)
}

function diaSeguinte(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + 1))
  return dt.toISOString().slice(0, 10)
}
