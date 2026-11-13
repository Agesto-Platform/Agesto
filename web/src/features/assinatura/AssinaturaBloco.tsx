import { Badge } from '../../components/ui'
import { SITUACAO, reais, vencimentoTexto } from '../../lib/assinatura'
import { useAssinatura } from './queries'

/** Bloco "Assinatura" da Parametrização (DEC-58): situação, vencimento, licenças e valor. */
export function AssinaturaBloco() {
  const assinatura = useAssinatura()
  const a = assinatura.data

  return (
    <section className="card set">
      <div>
        <h2>
          Assinatura {a && <Badge tone={SITUACAO[a.situacao].tone}>{SITUACAO[a.situacao].label}</Badge>}
        </h2>
        <p className="desc">Para mudar o plano, as licenças ou a forma de pagamento, fale com a equipe do Agesto.</p>
      </div>
      {assinatura.isLoading && <p className="hint">Carregando…</p>}
      {assinatura.isError && <p className="hint">Não foi possível carregar a assinatura agora.</p>}
      {a && (
        <dl className="assinatura-fatos">
          <div>
            <dt>Vencimento</dt>
            <dd>{vencimentoTexto(a)}</dd>
          </div>
          <div>
            <dt>Valor mensal</dt>
            <dd>{reais(a.valorMensal)}</dd>
          </div>
          <div>
            <dt>Acessos</dt>
            <dd>
              {a.acessosEmUso} de {a.acessosPermitidos} em uso
              <span className="hint">
                {' '}
                (você e {a.licencasFuncionarios} {a.licencasFuncionarios === 1 ? 'funcionário' : 'funcionários'})
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
