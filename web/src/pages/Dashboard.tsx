import { useLayoutEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from '../layout/AppShell'
import { PeriodSwitch, type Period } from '../layout/PeriodSwitch'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHead,
  DataTable,
  Kpi,
  PageHead,
  RankBar,
  RankList,
  Stats,
  brl,
  pct,
  type Column,
} from '../components/ui'
import { BarsChart } from '../components/BarsChart'
import { useAgenda, useDashboard } from '../lib/queries'
import { useAtendimentos } from '../features/atendimentos/queries'
import { StatusAtendimentoPill } from '../features/atendimentos/status'
import { clientesResource } from '../features/clientes/resource'
import { ApiError } from '../lib/api'
import { dataCurta, hojeExtenso, hora, iniciais, mesNome, MES_LONGO, SEMANA_CURTA } from '../lib/format'
import type { Atendimento } from '../types/api'

const COBRANCA: Record<string, string> = { PorHora: 'Por hora', Empreitada: 'Empreitada' }

/** "1 a 20 de outubro" / "últimos 7 dias" / "de janeiro até hoje". */
function periodoTexto(period: Period, hoje = new Date()): string {
  if (period === '7d') return 'Últimos 7 dias'
  if (period === 'ano') return `Janeiro a ${MES_LONGO[hoje.getMonth()]}`
  return `1 a ${hoje.getDate()} de ${MES_LONGO[hoje.getMonth()]}`
}

const NO_PERIODO: Record<Period, string> = { '7d': 'nos últimos 7 dias', mes: 'no mês', ano: 'no ano' }

/** Número que conta do zero na abertura pós-login (data-count). */
function Conta({ value, brlFmt = false }: { value: number; brlFmt?: boolean }) {
  return (
    <data value={value} data-count={value} data-fmt={brlFmt ? 'brl' : undefined}>
      {brlFmt ? brl(value) : value}
    </data>
  )
}

export function Dashboard() {
  const { period, setPeriod, entradaPronta } = useOutletContext<ShellContext>()
  const { data, isLoading, isError, error } = useDashboard(period)
  const atend = useAtendimentos()
  const agenda = useAgenda('mes')
  const clientes = clientesResource.useList()
  const [verTabela, setVerTabela] = useState(false)
  const [agora] = useState(() => Date.now())

  // avisa a abertura pós-login que os cards já estão na tela
  const pronto = !!data && !atend.isLoading
  useLayoutEffect(() => {
    if (pronto) entradaPronta()
  }, [pronto, entradaPronta])

  const clienteNome = (id: number) => clientes.data?.find((c) => c.id === id)?.nome ?? `Cliente #${id}`
  const resumo = (id: number) => agenda.data?.find((a) => a.id === id)?.resumo ?? '—'
  const ultimos = [...(atend.data ?? [])].sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro)).slice(0, 6)
  const proximo = (agenda.data ?? [])
    .filter((a) => a.status === 'Pendente' && a.dataAgendada && new Date(a.dataAgendada).getTime() >= agora)
    .sort((a, b) => a.dataAgendada!.localeCompare(b.dataAgendada!))[0]

  const head = (
    <PageHead
      title="Visão geral"
      badge={
        <Badge tone="brand" dot>
          {mesNome()}
        </Badge>
      }
      sub={`${hojeExtenso()} · quanto entrou, quanto sobrou e o que vem pela frente.`}
      actions={
        <>
          <PeriodSwitch value={period} onChange={setPeriod} />
          <ButtonLink to="/orcamentos" variant="primary" icon="plus" viewTransition>
            Novo orçamento
          </ButtonLink>
        </>
      }
    />
  )

  if (isLoading || isError || !data) {
    return (
      <>
        {head}
        <Card>
          <CardBody>
            <p className="hint" style={{ margin: 0, padding: '24px 0', textAlign: 'center' }}>
              {isLoading
                ? 'Carregando painel…'
                : `Não foi possível carregar o painel${error instanceof ApiError ? `: ${error.message}` : '.'}`}
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  const { rentabilidade: r, vendas, servicos, estoque } = data
  const maxServico = Math.max(...servicos.receitaPorServico.map((s) => s.receita), 0)

  const colunas: Column<Atendimento>[] = [
    {
      header: 'Cliente',
      cell: (a) => (
        <div className="cell">
          <span className="avatar sm">{iniciais(clienteNome(a.clienteId))}</span>
          <span className="strong">{clienteNome(a.clienteId)}</span>
        </div>
      ),
    },
    { header: 'Serviço', className: 'muted', cell: (a) => resumo(a.id) },
    { header: 'Data', cell: (a) => dataCurta(a.dataAgendada ?? a.dataRegistro) },
    { header: 'Status', cell: (a) => <StatusAtendimentoPill status={a.status} /> },
    { header: 'Total', align: 'right', className: 'strong', cell: (a) => brl(a.valorTotal) },
    {
      header: 'Margem',
      align: 'right',
      className: 'muted',
      cell: (a) => (a.custoTotal > 0 ? brl(a.margem) : <span title="Custo ainda não preenchido">—</span>),
    },
  ]

  return (
    <>
      {head}

      <div className="grid g-2">
        <Kpi
          label="Margem"
          icon="coins"
          value={<Conta value={r.margem} brlFmt />}
          foot={
            <>
              <b>{pct(r.margemPercentual)}</b> de tudo o que entrou {NO_PERIODO[period]} ficou com você.
            </>
          }
        />
        <Kpi
          label="Faturamento"
          icon="trend"
          tone="brand"
          value={<Conta value={r.faturamento} brlFmt />}
          foot={
            <>
              {periodoTexto(period)} · <b>{brl(r.custoTotal)}</b> de custo.
            </>
          }
        />
      </div>

      <Card className="mt" label="Resumo do período">
        <Stats
          items={[
            { label: 'Atendimentos concluídos', value: <Conta value={r.atendimentos} />, unit: NO_PERIODO[period] },
            { label: 'Ticket médio', value: <Conta value={r.ticketMedio} brlFmt />, unit: 'por atendimento' },
            {
              label: 'Próximo atendimento',
              value: proximo ? dataCurta(proximo.dataAgendada) : '—',
              unit: proximo ? `${hora(proximo.dataAgendada!)} · ${proximo.clienteNome}` : 'nada agendado',
            },
          ]}
        />
      </Card>

      <div className="grid g-main-side mt">
        <Card>
          <CardHead
            title="Receita por dia"
            subtitle="Quanto entrou em cada dia do período"
            action={
              <>
                <div className="chart-legend">
                  <span>
                    <i />
                    Receita
                  </span>
                  <span>
                    <i className="hi" />
                    Hoje
                  </span>
                </div>
                <Button size="sm" variant="ghost" aria-pressed={verTabela} onClick={() => setVerTabela((v) => !v)}>
                  Tabela
                </Button>
              </>
            }
          />
          <CardBody>
            {verTabela ? (
              <div className="table-wrap" style={{ maxHeight: 260, overflow: 'auto' }}>
                <table className="t">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th className="n">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...vendas.receitaPorPeriodo].reverse().map((p) => {
                      const d = new Date(p.data)
                      return (
                        <tr key={p.data}>
                          <td>
                            {SEMANA_CURTA[d.getDay()]} {dataCurta(d)}
                          </td>
                          <td className="n">{brl(p.valor)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <BarsChart pontos={vendas.receitaPorPeriodo} label="Receita por dia no período" />
            )}
          </CardBody>
        </Card>

        <div className="stack">
          <Card>
            <CardHead title="Serviços que mais faturam" subtitle={NO_PERIODO[period][0]!.toUpperCase() + NO_PERIODO[period].slice(1)} />
            <CardBody>
              <RankList>
                {servicos.receitaPorServico.map((s) => (
                  <RankBar
                    key={s.servicoId}
                    name={s.descricao}
                    meta={`${s.quantidade} atend. · ${COBRANCA[s.tipoCobranca] ?? s.tipoCobranca}`}
                    percent={maxServico > 0 ? (s.receita / maxServico) * 100 : 0}
                    amount={brl(s.receita)}
                  />
                ))}
                {servicos.receitaPorServico.length === 0 && <p className="hint">Nenhum serviço faturado no período.</p>}
              </RankList>
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Estoque · atenção" />
            <CardBody>
              {estoque.rupturaIminente.map((p) => (
                <Alert
                  key={p.produtoId}
                  tone="neg"
                  icon="alert"
                  title={`${p.nome} acaba em ~${Math.round(p.diasAteRuptura)} dias`}
                  subtitle={`${p.quantidadeEstoque} em estoque · consumo de ${p.consumoDiarioMedio.toLocaleString('pt-BR')} por dia`}
                />
              ))}
              {estoque.produtosParados.map((p) => (
                <Alert
                  key={p.produtoId}
                  tone="warn"
                  icon="archive"
                  title={`${p.nome} parado`}
                  subtitle={`${p.quantidadeEstoque} unidades · ${p.ultimaVenda ? 'última saída em ' + dataCurta(p.ultimaVenda) : 'sem saída registrada'}`}
                />
              ))}
              {estoque.rupturaIminente.length === 0 && estoque.produtosParados.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>
                  Nada a reportar.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt">
        <CardHead
          title="Últimos atendimentos"
          subtitle="Margem aparece quando o custo é preenchido"
          action={
            <ButtonLink to="/atendimentos" size="sm" viewTransition>
              Ver todos
            </ButtonLink>
          }
        />
        <div style={{ marginTop: 12 }}>
          <DataTable
            columns={colunas}
            rows={ultimos}
            loading={atend.isLoading}
            getKey={(a) => a.id}
            empty={{ title: 'Nenhum atendimento ainda', text: 'Os atendimentos registrados aparecem aqui.', icon: 'wrench' }}
          />
        </div>
      </Card>
    </>
  )
}
