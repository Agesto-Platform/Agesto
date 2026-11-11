import type { DashboardResponse } from '../../types/api'

/** Série diária de receita (30 dias até hoje), somando ~R$ 18.420. */
function buildSerie(): DashboardResponse['vendas']['receitaPorPeriodo'] {
  const valores = [
    380, 0, 520, 610, 0, 740, 430, 560, 0, 820, 690, 470, 0, 910, 640, 580, 0,
    760, 520, 880, 0, 690, 610, 0, 940, 720, 560, 0, 830, 650,
  ]
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return valores.map((valor, i) => {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - (valores.length - 1 - i))
    return { data: d.toISOString(), valor }
  })
}

/** Contrato-espelho do GET /api/metrics/dashboard (exemplo: AC Fernando). */
export const dashboardMock: DashboardResponse = {
  de: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  ate: new Date().toISOString(),
  rentabilidade: {
    faturamento: 18420,
    custoTotal: 7060,
    margem: 11360,
    margemPercentual: 61.7,
    atendimentos: 36,
    ticketMedio: 512,
  },
  vendas: {
    receitaTotal: 4260,
    ticketMedio: 512,
    totalAtendimentos: 36,
    topProdutos: [
      { produtoId: 1, nome: 'Suporte universal', quantidade: 24, receita: 1680 },
      { produtoId: 2, nome: 'Gás R-410a (kg)', quantidade: 18, receita: 1240 },
      { produtoId: 3, nome: 'Cano de dreno (m)', quantidade: 40, receita: 880 },
      { produtoId: 4, nome: 'Fita PVC', quantidade: 31, receita: 460 },
    ],
    receitaPorPeriodo: buildSerie(),
  },
  servicos: {
    receitaTotal: 14160,
    receitaPorServico: [
      {
        servicoId: 1,
        descricao: 'Instalação de AC',
        tipoCobranca: 'Empreitada',
        quantidade: 18,
        receita: 6400,
        horas: 36,
        receitaPorHora: 177.78,
      },
      {
        servicoId: 2,
        descricao: 'Manutenção preventiva',
        tipoCobranca: 'Hora',
        quantidade: 21,
        receita: 2980,
        horas: 21,
        receitaPorHora: 141.9,
      },
      {
        servicoId: 3,
        descricao: 'Limpeza / higienização',
        tipoCobranca: 'Hora',
        quantidade: 14,
        receita: 1980,
        horas: 14,
        receitaPorHora: 141.43,
      },
    ],
  },
  estoque: {
    giro: [
      { produtoId: 1, nome: 'Suporte universal', quantidadeEstoque: 16, unidadesVendidas: 24 },
      { produtoId: 3, nome: 'Cano de dreno (m)', quantidadeEstoque: 40, unidadesVendidas: 40 },
      { produtoId: 4, nome: 'Fita PVC', quantidadeEstoque: 31, unidadesVendidas: 31 },
      { produtoId: 2, nome: 'Gás R-410a (kg)', quantidadeEstoque: 3, unidadesVendidas: 18 },
    ],
    produtosParados: [
      {
        produtoId: 5,
        nome: 'Suporte de parede',
        quantidadeEstoque: 16,
        ultimaVenda: new Date(Date.now() - 42 * 864e5).toISOString(),
      },
    ],
    rupturaIminente: [
      {
        produtoId: 2,
        nome: 'Gás R-410a',
        quantidadeEstoque: 3,
        consumoDiarioMedio: 0.6,
        diasAteRuptura: 5,
      },
    ],
  },
}
