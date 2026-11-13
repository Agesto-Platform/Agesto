import { useState } from 'react'
import { Badge, Button, SelectField, TextField, brl, useToast } from '../../components/ui'
import { ApiError } from '../../lib/api'
import { dataBr } from '../../lib/assinatura'
import type { Atendimento, FormaRecebimento } from '../../types/api'
import { useRegistrarRecebimento } from './queries'

const FORMAS_RECEBIMENTO: { value: FormaRecebimento; label: string }[] = [
  { value: 'Pix', label: 'Pix' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'CartaoDebito', label: 'Cartão de débito' },
  { value: 'CartaoCredito', label: 'Cartão de crédito' },
  { value: 'Boleto', label: 'Boleto' },
  { value: 'Transferencia', label: 'Transferência' },
  { value: 'Outro', label: 'Outro' },
]

const rotuloRecebimento = (f: FormaRecebimento | null | undefined) =>
  FORMAS_RECEBIMENTO.find((x) => x.value === f)?.label ?? '—'

const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Selo da lista: pago ou a receber (só concluídos ficam "a receber"). */
export function SeloRecebimento({ atendimento: a }: { atendimento: Atendimento }) {
  if (a.pagoEm) return <Badge tone="ok">Pago</Badge>
  if (a.status === 'Concluido') return <Badge tone="warn">A receber</Badge>
  return null
}

/**
 * Cobrança do atendimento no detalhe (TASKS L5): registra quando e como o
 * cliente pagou, ou volta para "a receber". Cancelado não recebe pagamento.
 */
export function Recebimento({ atendimento: a }: { atendimento: Atendimento }) {
  const toast = useToast()
  const registrar = useRegistrarRecebimento()
  const [pagoEm, setPagoEm] = useState(hojeIso())
  const [forma, setForma] = useState<FormaRecebimento>('Pix')

  if (a.status === 'Cancelado' && !a.pagoEm) return null

  const salvar = async (novo: { pagoEm: string | null; forma: FormaRecebimento | null }) => {
    try {
      await registrar.mutateAsync({ id: a.id, ...novo })
      toast.success(novo.pagoEm ? 'Recebimento registrado.' : 'Atendimento de volta para a receber.')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar o recebimento.')
    }
  }

  if (a.pagoEm) {
    return (
      <section className="recebimento pago" aria-label="Recebimento">
        <div>
          <b>Recebido em {dataBr(a.pagoEm)}</b>
          <span>
            {rotuloRecebimento(a.formaPagamento)} · {brl(a.valorTotal)}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void salvar({ pagoEm: null, forma: null })} disabled={registrar.isPending}>
          Voltar para a receber
        </Button>
      </section>
    )
  }

  return (
    <section className="recebimento" aria-label="Recebimento">
      <div>
        <b>{a.status === 'Concluido' ? `A receber: ${brl(a.valorTotal)}` : 'Ainda não recebido'}</b>
        <span>Quando o cliente pagar, registre aqui a data e a forma.</span>
      </div>
      <div className="recebimento-form">
        <TextField label="Pago em" type="date" value={pagoEm} onChange={setPagoEm} required />
        <SelectField<FormaRecebimento> label="Forma" value={forma} onChange={setForma} options={FORMAS_RECEBIMENTO} />
        <Button
          variant="primary"
          size="sm"
          icon="check"
          onClick={() => void salvar({ pagoEm, forma })}
          disabled={registrar.isPending || !pagoEm}
        >
          {registrar.isPending ? 'Salvando…' : 'Registrar recebimento'}
        </Button>
      </div>
    </section>
  )
}
