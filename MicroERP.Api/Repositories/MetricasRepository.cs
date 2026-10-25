using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class MetricasRepository : IMetricasRepository
{
    private const int TopProdutos = 5;
    private const int DiasSemVendaParado = 30;
    private const int LimiarRupturaDias = 7;

    private readonly AppDbContext _dbContext;

    public MetricasRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<MetricasRentabilidadeResponse> GetRentabilidadeAsync(long empresaId, DateTime de, DateTime ate, CancellationToken cancellationToken)
    {
        // Rentabilidade do periodo = atendimentos Concluidos. Soma client-side (portavel
        // entre provedores; SQLite nao suporta SUM sobre decimal no servidor).
        var atendimentos = await _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId
                        && a.DeletedAt == null
                        && a.Status == StatusAtendimento.Concluido
                        && a.DataRegistro >= de
                        && a.DataRegistro <= ate)
            .Select(a => new { a.ValorTotal, a.CustoTotal })
            .ToListAsync(cancellationToken);

        var faturamento = atendimentos.Sum(x => x.ValorTotal);
        var custo = atendimentos.Sum(x => x.CustoTotal);
        var margem = faturamento - custo;
        var count = atendimentos.Count;

        return new MetricasRentabilidadeResponse
        {
            Faturamento = faturamento,
            CustoTotal = custo,
            Margem = margem,
            MargemPercentual = faturamento > 0 ? Math.Round(margem / faturamento * 100m, 1) : 0m,
            Atendimentos = count,
            TicketMedio = count > 0 ? faturamento / count : 0m
        };
    }

    public async Task<MetricasVendasResponse> GetVendasAsync(long empresaId, DateTime de, DateTime ate, CancellationToken cancellationToken)
    {
        // Bloco "Vendas" = receita de PRODUTOS (itens de produto), consistente com o
        // bloco "Servicos" que cobre os itens de servico. Considera apenas atendimentos
        // Concluidos no periodo (exclui Pendente e Cancelado). TicketMedio e TotalAtendimentos
        // referem-se aos atendimentos que tiveram venda de produto.
        var linhas = await (
            from ip in _dbContext.ItemProdutos.AsNoTracking()
            join a in _dbContext.Atendimentos on ip.AtendimentoId equals a.Id
                // Itens avulsos (ProdutoId nulo) nao entram no ranking de produto de catalogo.
            join p in _dbContext.Produtos on ip.ProdutoId equals (long?)p.Id
            where a.EmpresaId == empresaId
                  && a.DeletedAt == null
                  && ip.DeletedAt == null
                  && p.DeletedAt == null
                  && a.Status == StatusAtendimento.Concluido
                  && a.DataRegistro >= de
                  && a.DataRegistro <= ate
            select new
            {
                AtendimentoId = a.Id,
                a.DataRegistro,
                ip.ProdutoId,
                p.Nome,
                ip.Quantidade,
                ip.Subtotal
            })
            .ToListAsync(cancellationToken);

        var receitaTotal = linhas.Sum(x => x.Subtotal);
        var totalAtendimentos = linhas.Select(x => x.AtendimentoId).Distinct().Count();
        var ticketMedio = totalAtendimentos > 0 ? receitaTotal / totalAtendimentos : 0m;

        var topProdutos = linhas
            .GroupBy(x => new { x.ProdutoId, x.Nome })
            .Select(g => new ProdutoRankingItem
            {
                ProdutoId = g.Key.ProdutoId!.Value,
                Nome = g.Key.Nome,
                Quantidade = g.Sum(x => x.Quantidade),
                Receita = g.Sum(x => x.Subtotal)
            })
            .OrderByDescending(x => x.Receita)
            .Take(TopProdutos)
            .ToList();

        var receitaPorPeriodo = linhas
            .GroupBy(x => x.DataRegistro.Date)
            .Select(g => new FaturamentoPontoPeriodo
            {
                Data = g.Key,
                Valor = g.Sum(x => x.Subtotal)
            })
            .OrderBy(p => p.Data)
            .ToList();

        return new MetricasVendasResponse
        {
            ReceitaTotal = receitaTotal,
            TicketMedio = ticketMedio,
            TotalAtendimentos = totalAtendimentos,
            TopProdutos = topProdutos,
            ReceitaPorPeriodo = receitaPorPeriodo
        };
    }

    public async Task<MetricasServicosResponse> GetServicosAsync(long empresaId, DateTime de, DateTime ate, CancellationToken cancellationToken)
    {
        var grouped = await (
            from isv in _dbContext.ItemServicos.AsNoTracking()
            join a in _dbContext.Atendimentos on isv.AtendimentoId equals a.Id
            join s in _dbContext.Servicos on isv.ServicoId equals s.Id
            where a.EmpresaId == empresaId
                  && a.DeletedAt == null
                  && isv.DeletedAt == null
                  && s.DeletedAt == null
                  && a.Status == StatusAtendimento.Concluido
                  && a.DataRegistro >= de
                  && a.DataRegistro <= ate
            group new { isv.Quantidade, isv.Subtotal } by new { isv.ServicoId, s.Descricao, s.TipoCobranca, s.DuracaoMinutos } into g
            select new
            {
                g.Key.ServicoId,
                g.Key.Descricao,
                g.Key.TipoCobranca,
                g.Key.DuracaoMinutos,
                Quantidade = g.Sum(x => x.Quantidade),
                Receita = g.Sum(x => x.Subtotal)
            })
            .ToListAsync(cancellationToken);

        var receitaPorServico = grouped
            .Select(x =>
            {
                var horas = HorasTrabalhadas(x.TipoCobranca, x.Quantidade, x.DuracaoMinutos);
                return new ServicoReceitaItem
                {
                    ServicoId = x.ServicoId,
                    Descricao = x.Descricao,
                    TipoCobranca = x.TipoCobranca.ToString(),
                    Quantidade = x.Quantidade,
                    Receita = x.Receita,
                    Horas = horas,
                    ReceitaPorHora = horas > 0 ? Math.Round(x.Receita / horas.Value, 2) : null
                };
            })
            .OrderByDescending(x => x.Receita)
            .ToList();

        return new MetricasServicosResponse
        {
            ReceitaTotal = receitaPorServico.Sum(x => x.Receita),
            ReceitaPorServico = receitaPorServico
        };
    }

    // Por hora, a quantidade lançada já são as horas. Por empreitada, cada execução
    // vale a duração estimada do serviço; sem ela, não há como saber o tempo.
    private static decimal? HorasTrabalhadas(TipoCobranca tipo, int quantidade, int? duracaoMinutos)
    {
        if (tipo == TipoCobranca.PorHora) return quantidade;
        return duracaoMinutos is > 0 ? Math.Round(quantidade * duracaoMinutos.Value / 60m, 2) : null;
    }

    public async Task<MetricasEstoqueResponse> GetEstoqueAsync(long empresaId, DateTime de, DateTime ate, CancellationToken cancellationToken)
    {
        var produtos = await _dbContext.Produtos
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId && p.DeletedAt == null)
            .Select(p => new { p.Id, p.Nome, p.QuantidadeEstoque })
            .ToListAsync(cancellationToken);

        // Movimentacao de estoque = itens de atendimentos nao cancelados (o estoque
        // baixa na criacao do item, independentemente da conclusao do atendimento).
        var vendidasNoPeriodo = await (
            from ip in _dbContext.ItemProdutos.AsNoTracking()
            join a in _dbContext.Atendimentos on ip.AtendimentoId equals a.Id
            where a.EmpresaId == empresaId
                  && a.DeletedAt == null
                  && ip.DeletedAt == null
                  && a.Status != StatusAtendimento.Cancelado
                  && a.DataRegistro >= de
                  && a.DataRegistro <= ate
            group ip.Quantidade by ip.ProdutoId into g
            select new { ProdutoId = g.Key, Unidades = g.Sum(x => x) })
            .ToListAsync(cancellationToken);

        // "Ultima venda" e intencionalmente all-time (sem filtro de periodo): serve
        // para decidir "produto parado" comparando a ultima saida com o corte de N dias
        // relativo a 'ate', independentemente da janela de analise.
        var ultimaVendaPorProduto = await (
            from ip in _dbContext.ItemProdutos.AsNoTracking()
            join a in _dbContext.Atendimentos on ip.AtendimentoId equals a.Id
            where a.EmpresaId == empresaId
                  && a.DeletedAt == null
                  && ip.DeletedAt == null
                  && a.Status != StatusAtendimento.Cancelado
            group a.DataRegistro by ip.ProdutoId into g
            select new { ProdutoId = g.Key, UltimaVenda = g.Max(d => d) })
            .ToListAsync(cancellationToken);

        var diasNoPeriodo = Math.Max(1, (ate.Date - de.Date).Days + 1);
        var limiteParado = ate.AddDays(-DiasSemVendaParado);

        var giro = produtos
            .Select(p => new ProdutoGiroItem
            {
                ProdutoId = p.Id,
                Nome = p.Nome,
                QuantidadeEstoque = p.QuantidadeEstoque,
                UnidadesVendidas = vendidasNoPeriodo.FirstOrDefault(v => v.ProdutoId == p.Id)?.Unidades ?? 0
            })
            .OrderByDescending(x => x.UnidadesVendidas)
            .ToList();

        var produtosParados = produtos
            .Select(p => new
            {
                p.Id,
                p.Nome,
                p.QuantidadeEstoque,
                UltimaVenda = ultimaVendaPorProduto.FirstOrDefault(u => u.ProdutoId == p.Id)?.UltimaVenda
            })
            .Where(p => p.UltimaVenda == null || p.UltimaVenda < limiteParado)
            .Select(p => new ProdutoParadoItem
            {
                ProdutoId = p.Id,
                Nome = p.Nome,
                QuantidadeEstoque = p.QuantidadeEstoque,
                UltimaVenda = p.UltimaVenda
            })
            .ToList();

        var rupturaIminente = produtos
            .Select(p =>
            {
                var unidades = vendidasNoPeriodo.FirstOrDefault(v => v.ProdutoId == p.Id)?.Unidades ?? 0;
                var consumoDiario = (double)unidades / diasNoPeriodo;
                var diasAteRuptura = consumoDiario > 0 ? p.QuantidadeEstoque / consumoDiario : double.PositiveInfinity;
                return new { p.Id, p.Nome, p.QuantidadeEstoque, consumoDiario, diasAteRuptura };
            })
            .Where(p => p.consumoDiario > 0 && p.diasAteRuptura <= LimiarRupturaDias)
            .OrderBy(p => p.diasAteRuptura)
            .Select(p => new RupturaIminenteItem
            {
                ProdutoId = p.Id,
                Nome = p.Nome,
                QuantidadeEstoque = p.QuantidadeEstoque,
                ConsumoDiarioMedio = Math.Round(p.consumoDiario, 4),
                DiasAteRuptura = Math.Round(p.diasAteRuptura, 2)
            })
            .ToList();

        return new MetricasEstoqueResponse
        {
            Giro = giro,
            ProdutosParados = produtosParados,
            RupturaIminente = rupturaIminente
        };
    }
}
