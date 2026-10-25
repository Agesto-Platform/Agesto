import { useOutletContext } from 'react-router-dom'
import type { ShellContext } from '../../layout/AppShell'
import { PeriodSwitch, type Period } from '../../layout/PeriodSwitch'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  PageHead,
  RankBar,
  RankList,
  brl,
  pct,
} from '../../components/ui'
import { useDashboard } from '../../lib/queries'
import { periodRange } from '../../lib/period'
import { ApiError } from '../../lib/api'
import { MES_LONGO } from '../../lib/format'
import type { DashboardResponse } from '../../types/api'
import './relatorios.css'

const COBRANCA: Record<string, string> = { PorHora: 'Por hora', Hora: 'Por hora', Empreitada: 'Empreitada' }
const NO_PERIODO: Record<Period, string> = { '7d': 'nos últimos 7 dias', mes: 'no mês', ano: 'no ano' }
const DIA_MS = 864e5

/** "1 a 20 de outubro de 2026" / "28 de setembro a 4 de outubro de 2026". */
function periodoExtenso(deIso: string, ateIso: string): string {
  const de = new Date(deIso)
  const ate = new Date(ateIso)
  const fim = `${ate.getDate()} de ${MES_LONGO[ate.getMonth()]} de ${ate.getFullYear()}`
  if (de.getFullYear() !== ate.getFullYear()) return `${de.getDate()} de ${MES_LONGO[de.getMonth()]} de ${de.getFullYear()} a ${fim}`
  if (de.getMonth() !== ate.getMonth()) return `${de.getDate()} de ${MES_LONGO[de.getMonth()]} a ${fim}`
  return `${de.getDate()} a ${fim}`
}

/** Card "Futuro": com o que o período atual seria comparado. */
function comparacao(period: Period, ate: Date): { titulo: string; vazio: string } {
  if (period === '7d') return { titulo: 'Comparar com a semana anterior', vazio: 'Ainda sem histórico da semana anterior' }
  if (period === 'ano') return { titulo: `Comparar com ${ate.getFullYear() - 1}`, vazio: 'Ainda sem histórico do ano anterior' }
  return { titulo: `Comparar com ${MES_LONGO[(ate.getMonth() + 11) % 12]}`, vazio: 'Ainda sem histórico do mês anterior' }
}

/** Planilha (CSV com ";", abre direto no Excel em pt-BR) com os números da tela. */
function exportarCsv(data: DashboardResponse) {
  const { rentabilidade: r, servicos, vendas, estoque } = data
  const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false })
  const linhas: (string | number)[][] = [
    ['Relatório', periodoExtenso(data.de, data.ate)],
    [],
    ['Faturamento', num(r.faturamento)],
    ['Custo', num(r.custoTotal)],
    ['Margem', num(r.margem)],
    ['Margem %', num(r.margemPercentual)],
    ['Atendimentos', r.atendimentos],
    ['Ticket médio', num(r.ticketMedio)],
    [],
    ['Serviço', 'Atendimentos', 'Receita', 'Receita por hora'],
    ...servicos.receitaPorServico.map((s) => [s.descricao, s.quantidade, num(s.receita), s.receitaPorHora === null ? '' : num(s.receitaPorHora)]),
    [],
    ['Produto', 'Quantidade', 'Receita'],
    ...vendas.topProdutos.map((p) => [p.nome, p.quantidade, num(p.receita)]),
    [],
    ['Produto', 'Em estoque', 'Vendidas'],
    ...estoque.giro.map((g) => [g.nome, g.quantidadeEstoque, g.unidadesVendidas]),
  ]
  const csv = linhas
    .map((l) => l.map((c) => (/[";\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(';'))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `agesto-relatorio-${data.de.slice(0, 10)}-a-${data.ate.slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function RelatoriosPage() {
  const { period, setPeriod } = useOutletContext<ShellContext>()
  const { data, isLoading, isError, error } = useDashboard(period)

  const faixa = data ?? periodRange(period)
  const head = (
    <PageHead
      title="Relatórios"
      sub={`${periodoExtenso(faixa.de, faixa.ate)} · números calculados pelo sistema, sem estimativa.`}
      actions={
        <>
          <PeriodSwitch value={period} onChange={setPeriod} />
          <Button icon="download" disabled={!data} onClick={() => data && exportarCsv(data)}>
            Exportar
          </Button>
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
                ? 'Carregando relatório…'
                : `Não foi possível carregar o relatório${error instanceof ApiError ? `: ${error.message}` : '.'}`}
            </p>
          </CardBody>
        </Card>
      </>
    )
  }

  const { rentabilidade: r, vendas, servicos, estoque } = data
  const noPeriodo = NO_PERIODO[period]
  const ate = new Date(data.ate)

  // Quanto sobrou: barras proporcionais ao faturamento
  const fluxo = [
    { nome: 'Faturamento', valor: r.faturamento, cls: '', pct: '' },
    { nome: 'Custo', valor: r.custoTotal, cls: ' cost', pct: '' },
    { nome: 'Margem', valor: r.margem, cls: ' hi', pct: pct(r.margemPercentual) },
  ]
  const largura = (v: number) => (r.faturamento > 0 ? Math.max(0, Math.min(100, (v / r.faturamento) * 100)) : 0)

  // De onde vem o faturamento: itens de serviço x itens de produto (mesmo filtro: concluídos no período)
  const recServicos = servicos.receitaTotal
  const recProdutos = vendas.receitaTotal
  const totalSplit = recServicos + recProdutos
  const partServicos = totalSplit > 0 ? (recServicos / totalSplit) * 100 : 0
  const partProdutos = totalSplit > 0 ? 100 - partServicos : 0

  const maxServico = Math.max(...servicos.receitaPorServico.map((s) => s.receita), 0)
  const maxProduto = Math.max(...vendas.topProdutos.map((p) => p.receita), 0)

  // Giro: produtos que saíram + parados (sem saída no período), com o alerta de cada um
  const ruptura = new Map(estoque.rupturaIminente.map((x) => [x.produtoId, x]))
  const parado = new Map(estoque.produtosParados.map((x) => [x.produtoId, x]))
  const noGiro = new Set(estoque.giro.map((g) => g.produtoId))
  const giro = [
    ...estoque.giro.map((g) => ({ id: g.produtoId, nome: g.nome, estoque: g.quantidadeEstoque, vendidas: g.unidadesVendidas })),
    ...estoque.produtosParados
      .filter((p) => !noGiro.has(p.produtoId))
      .map((p) => ({ id: p.produtoId, nome: p.nome, estoque: p.quantidadeEstoque, vendidas: 0 })),
  ]
  const alerta = (id: number) => {
    const rup = ruptura.get(id)
    if (rup)
      return (
        <Badge tone="neg" icon="alert">
          Acaba em ~{Math.round(rup.diasAteRuptura)} dias
        </Badge>
      )
    const par = parado.get(id)
    if (par)
      return (
        <Badge tone="warn" icon="archive">
          {par.ultimaVenda
            ? `Parado ${Math.max(0, Math.floor((ate.getTime() - new Date(par.ultimaVenda).getTime()) / DIA_MS))} dias`
            : 'Parado'}
        </Badge>
      )
    return null
  }

  const comp = comparacao(period, ate)

  return (
    <>
      {head}

      <div className="grid g-2">
        <Card>
          <CardHead title="Quanto sobrou" subtitle="Faturamento menos o custo dos materiais" />
          <CardBody>
            <div className="flow">
              {fluxo.map((f) => (
                <div className="flow-row" key={f.nome}>
                  <span className="lbl">
                    <b>{f.nome}</b>
                  </span>
                  <div className={`track animate${f.cls}`}>
                    <i style={{ width: `${largura(f.valor)}%` }} />
                  </div>
                  <span className="v">
                    {brl(f.valor)}
                    <span>{f.pct || ' '}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="De onde vem o faturamento" subtitle={`Serviços e produtos ${noPeriodo}`} />
          <CardBody style={{ paddingTop: 22 }}>
            <div className="split" role="img" aria-label={`Serviços ${brl(recServicos)}; Produtos ${brl(recProdutos)}`}>
              <i style={{ width: `${partServicos}%` }} />
              <i style={{ width: `${partProdutos}%` }} />
            </div>
            <div className="split-legend">
              <span>
                <i />
                Serviços <b>{brl(recServicos)}</b>
              </span>
              <span>
                <i className="hi" />
                Produtos <b>{brl(recProdutos)}</b>
              </span>
            </div>
            <p className="hint" style={{ margin: '16px 0 0' }}>
              Ticket médio de <b style={{ color: 'var(--ink)' }}>{brl(r.ticketMedio)}</b> em {r.atendimentos}{' '}
              {r.atendimentos === 1 ? 'atendimento' : 'atendimentos'}.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid g-2 mt">
        <Card>
          <CardHead title="Receita por serviço" subtitle={`Atendimentos e receita ${noPeriodo}`} />
          <CardBody>
            <RankList>
              {servicos.receitaPorServico.map((s) => (
                <RankBar
                  key={s.servicoId}
                  name={s.descricao}
                  meta={`${s.quantidade} ${s.quantidade === 1 ? 'atendimento' : 'atendimentos'} · ${COBRANCA[s.tipoCobranca] ?? s.tipoCobranca}${s.receitaPorHora === null ? '' : ` · ${brl(s.receitaPorHora)}/h`}`}
                  percent={maxServico > 0 ? (s.receita / maxServico) * 100 : 0}
                  amount={brl(s.receita)}
                />
              ))}
              {servicos.receitaPorServico.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>
                  Nenhum serviço faturado no período.
                </p>
              )}
            </RankList>
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Produtos mais vendidos" subtitle={`Quantidade e receita ${noPeriodo}`} />
          <CardBody>
            <RankList>
              {vendas.topProdutos.map((p) => (
                <RankBar
                  key={p.produtoId}
                  name={p.nome}
                  meta={`${p.quantidade} ${p.quantidade === 1 ? 'unidade' : 'unidades'}`}
                  percent={maxProduto > 0 ? (p.receita / maxProduto) * 100 : 0}
                  amount={brl(p.receita)}
                />
              ))}
              {vendas.topProdutos.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>
                  Nenhum produto vendido no período.
                </p>
              )}
            </RankList>
          </CardBody>
        </Card>
      </div>

      <div className="grid g-main-side mt">
        <Card>
          <CardHead title="Giro de estoque" subtitle="Quanto saiu em relação ao que tem" />
          {giro.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="t">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="n">Em estoque</th>
                    <th className="n">Vendidas {noPeriodo}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {giro.map((g) => (
                    <tr key={g.id}>
                      <td className="strong">{g.nome}</td>
                      <td className="n">{g.estoque}</td>
                      <td className={g.vendidas === 0 ? 'n muted' : 'n'}>{g.vendidas}</td>
                      <td>{alerta(g.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="box" title="Sem movimento de estoque">
              Os produtos que saírem no período aparecem aqui.
            </Empty>
          )}
        </Card>
        <Card>
          <CardHead title={comp.titulo} action={<Badge tone="future">Futuro</Badge>} />
          <Empty icon="trend" title={comp.vazio} style={{ padding: '26px 16px 30px' }}>
            A comparação entra quando a API passar a guardar o período anterior. Por técnico também depende de backend novo.
          </Empty>
        </Card>
      </div>
    </>
  )
}
