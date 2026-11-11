using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

public sealed class MetricasServiceTests
{
    private static readonly DateTime De = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Ate = new(2026, 12, 31, 23, 59, 59, DateTimeKind.Utc);
    private static readonly DateTime NoPeriodo = new(2026, 6, 15, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task GetVendas_SomaSoConcluidosDaEmpresaEIgnoraCanceladoEOutraEmpresa()
    {
        await using var db = CreateContext();

        db.Produtos.AddRange(
            Produto(1, "Cano PVC", empresaId: 1, estoque: 100),
            Produto(2, "Registro", empresaId: 1, estoque: 100),
            Produto(9, "Produto Outra Empresa", empresaId: 2, estoque: 100));

        // Empresa 1 — 2 concluidos (contam), 1 cancelado e 1 pendente (nao contam)
        AddAtendimentoComProduto(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 300, NoPeriodo,
            (produtoId: 1, qtd: 2, subtotal: 200m), (produtoId: 2, qtd: 1, subtotal: 100m));
        AddAtendimentoComProduto(db, atId: 2, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 100, NoPeriodo,
            (produtoId: 1, qtd: 1, subtotal: 100m));
        AddAtendimentoComProduto(db, atId: 3, empresaId: 1, StatusAtendimento.Cancelado, valorTotal: 999, NoPeriodo,
            (produtoId: 1, qtd: 5, subtotal: 500m));
        AddAtendimentoComProduto(db, atId: 4, empresaId: 1, StatusAtendimento.Pendente, valorTotal: 50, NoPeriodo);
        // Empresa 2 — nao deve aparecer para a empresa 1
        AddAtendimentoComProduto(db, atId: 5, empresaId: 2, StatusAtendimento.Concluido, valorTotal: 5000, NoPeriodo,
            (produtoId: 9, qtd: 10, subtotal: 5000m));
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var vendas = await service.GetVendasAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(400m, vendas.ReceitaTotal);
        Assert.Equal(2, vendas.TotalAtendimentos);
        Assert.Equal(200m, vendas.TicketMedio);

        Assert.Equal(2, vendas.TopProdutos.Count);
        var topCano = vendas.TopProdutos.First();
        Assert.Equal(1, topCano.ProdutoId);
        Assert.Equal(3, topCano.Quantidade);   // 2 + 1
        Assert.Equal(300m, topCano.Receita);    // 200 + 100
    }

    [Fact]
    public async Task GetServicos_AgrupaPorServicoEIgnoraCancelado()
    {
        await using var db = CreateContext();
        db.Servicos.AddRange(
            Servico(1, "Instalacao AC", TipoCobranca.Empreitada, empresaId: 1),
            Servico(2, "Manutencao", TipoCobranca.PorHora, empresaId: 1));

        AddAtendimentoComServico(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 550, NoPeriodo,
            (servicoId: 1, qtd: 2, subtotal: 400m), (servicoId: 2, qtd: 1, subtotal: 150m));
        AddAtendimentoComServico(db, atId: 2, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 200, NoPeriodo,
            (servicoId: 1, qtd: 1, subtotal: 200m));
        AddAtendimentoComServico(db, atId: 3, empresaId: 1, StatusAtendimento.Cancelado, valorTotal: 999, NoPeriodo,
            (servicoId: 1, qtd: 9, subtotal: 999m));
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var servicos = await service.GetServicosAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(750m, servicos.ReceitaTotal);
        var ac = servicos.ReceitaPorServico.First();
        Assert.Equal(1, ac.ServicoId);
        Assert.Equal(600m, ac.Receita);   // 400 + 200
        Assert.Equal(3, ac.Quantidade);   // 2 + 1
        Assert.Equal("Empreitada", ac.TipoCobranca);
    }

    [Fact]
    public async Task GetServicos_ReceitaPorHora_UsaHorasLancadasOuDuracaoEstimada()
    {
        await using var db = CreateContext();
        var instalacao = Servico(1, "Instalacao AC", TipoCobranca.Empreitada, empresaId: 1);
        instalacao.DuracaoMinutos = 90;
        db.Servicos.AddRange(
            instalacao,
            Servico(2, "Manutencao", TipoCobranca.PorHora, empresaId: 1),
            Servico(3, "Limpeza de dreno", TipoCobranca.Empreitada, empresaId: 1)); // sem duração

        AddAtendimentoComServico(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 1000, NoPeriodo,
            (servicoId: 1, qtd: 2, subtotal: 600m),   // 2 x 90 min = 3 h
            (servicoId: 2, qtd: 4, subtotal: 400m),   // 4 h lançadas
            (servicoId: 3, qtd: 1, subtotal: 120m));
        await db.SaveChangesAsync();

        var servicos = await new MetricasService(new MetricasRepository(db)).GetServicosAsync(1, De, Ate, CancellationToken.None);

        var ac = servicos.ReceitaPorServico.Single(s => s.ServicoId == 1);
        Assert.Equal(3m, ac.Horas);
        Assert.Equal(200m, ac.ReceitaPorHora);
        var manutencao = servicos.ReceitaPorServico.Single(s => s.ServicoId == 2);
        Assert.Equal(4m, manutencao.Horas);
        Assert.Equal(100m, manutencao.ReceitaPorHora);
        var dreno = servicos.ReceitaPorServico.Single(s => s.ServicoId == 3);
        Assert.Null(dreno.Horas);
        Assert.Null(dreno.ReceitaPorHora);
    }

    [Fact]
    public async Task GetEstoque_CalculaGiroParadosERuptura()
    {
        await using var db = CreateContext();
        var de = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var ate = new DateTime(2026, 6, 10, 23, 59, 59, DateTimeKind.Utc);
        var dentro = new DateTime(2026, 6, 5, 10, 0, 0, DateTimeKind.Utc);

        db.Produtos.AddRange(
            Produto(1, "Alta saida", empresaId: 1, estoque: 5),    // vende muito, pouco estoque -> ruptura
            Produto(2, "Estavel", empresaId: 1, estoque: 100),     // vende pouco -> ok
            Produto(3, "Nunca vendido", empresaId: 1, estoque: 10), // parado (sem venda)
            Produto(4, "Venda antiga", empresaId: 1, estoque: 8));  // parado (venda ha muito)

        AddAtendimentoComProduto(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 0, dentro,
            (produtoId: 1, qtd: 20, subtotal: 0m), (produtoId: 2, qtd: 1, subtotal: 0m));
        // Produto 4 vendido no inicio do ano (fora da janela e ha mais de 30 dias)
        AddAtendimentoComProduto(db, atId: 2, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 0,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            (produtoId: 4, qtd: 1, subtotal: 0m));
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var estoque = await service.GetEstoqueAsync(1, de, ate, CancellationToken.None);

        // Giro: produto 1 com 20 unidades no topo
        Assert.Equal(1, estoque.Giro.First().ProdutoId);
        Assert.Equal(20, estoque.Giro.First().UnidadesVendidas);

        // Ruptura: apenas o produto 1 (5 / (20/10) = 2.5 dias <= 7)
        Assert.Single(estoque.RupturaIminente);
        Assert.Equal(1, estoque.RupturaIminente[0].ProdutoId);
        Assert.Equal(2.5, estoque.RupturaIminente[0].DiasAteRuptura);

        // Parados: produtos 3 (nunca vendido) e 4 (venda antiga)
        var paradosIds = estoque.ProdutosParados.Select(p => p.ProdutoId).OrderBy(x => x).ToList();
        Assert.Equal(new long[] { 3, 4 }, paradosIds);
    }

    [Fact]
    public async Task GetDashboard_ConsolidaOsTresBlocosComPeriodo()
    {
        await using var db = CreateContext();
        db.Produtos.Add(Produto(1, "Cano", empresaId: 1, estoque: 50));
        db.Servicos.Add(Servico(1, "Instalacao", TipoCobranca.Empreitada, empresaId: 1));
        AddAtendimentoComProduto(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 100, NoPeriodo,
            (produtoId: 1, qtd: 1, subtotal: 100m));
        AddAtendimentoComServico(db, atId: 2, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 300, NoPeriodo,
            (servicoId: 1, qtd: 1, subtotal: 300m));
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var dash = await service.GetDashboardAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(De, dash.De);
        Assert.Equal(Ate, dash.Ate);
        Assert.Equal(100m, dash.Vendas.ReceitaTotal);
        Assert.Equal(300m, dash.Servicos.ReceitaTotal);
        Assert.NotEmpty(dash.Estoque.Giro);
    }

    [Fact]
    public async Task GetVendas_IgnoraProdutoSoftDeletado()
    {
        await using var db = CreateContext();
        var ativo = Produto(1, "Ativo", empresaId: 1, estoque: 100);
        var removido = Produto(2, "Removido", empresaId: 1, estoque: 100);
        removido.DeletedAt = DateTime.UtcNow;
        db.Produtos.AddRange(ativo, removido);

        AddAtendimentoComProduto(db, atId: 1, empresaId: 1, StatusAtendimento.Concluido, valorTotal: 300, NoPeriodo,
            (produtoId: 1, qtd: 1, subtotal: 100m), (produtoId: 2, qtd: 1, subtotal: 200m));
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var vendas = await service.GetVendasAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(100m, vendas.ReceitaTotal); // so o produto ativo
        Assert.Single(vendas.TopProdutos);
        Assert.Equal(1, vendas.TopProdutos[0].ProdutoId);
    }

    [Fact]
    public async Task GetVendas_QuandoSemDados_RetornaZeros()
    {
        await using var db = CreateContext();
        var service = new MetricasService(new MetricasRepository(db));

        var vendas = await service.GetVendasAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(0m, vendas.ReceitaTotal);
        Assert.Equal(0, vendas.TotalAtendimentos);
        Assert.Equal(0m, vendas.TicketMedio);
        Assert.Empty(vendas.TopProdutos);
    }

    [Fact]
    public async Task GetRentabilidade_SomaFaturamentoEMargemDosConcluidos()
    {
        await using var db = CreateContext();
        db.Atendimentos.AddRange(
            new Atendimento { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 1, ClienteId = 1, Status = StatusAtendimento.Concluido, DataRegistro = NoPeriodo, ValorTotal = 1000m, CustoTotal = 400m },
            new Atendimento { Id = 2, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 1, ClienteId = 1, Status = StatusAtendimento.Concluido, DataRegistro = NoPeriodo, ValorTotal = 500m, CustoTotal = 100m },
            new Atendimento { Id = 3, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 1, ClienteId = 1, Status = StatusAtendimento.Cancelado, DataRegistro = NoPeriodo, ValorTotal = 999m, CustoTotal = 999m },
            new Atendimento { Id = 4, Uuid = Guid.NewGuid(), EmpresaId = 2, UsuarioId = 1, ClienteId = 1, Status = StatusAtendimento.Concluido, DataRegistro = NoPeriodo, ValorTotal = 5000m, CustoTotal = 0m });
        await db.SaveChangesAsync();

        var service = new MetricasService(new MetricasRepository(db));
        var r = await service.GetRentabilidadeAsync(1, De, Ate, CancellationToken.None);

        Assert.Equal(1500m, r.Faturamento);   // 1000 + 500 (Cancelado e outra empresa fora)
        Assert.Equal(500m, r.CustoTotal);     // 400 + 100
        Assert.Equal(1000m, r.Margem);
        Assert.Equal(66.7m, r.MargemPercentual); // 1000/1500
        Assert.Equal(2, r.Atendimentos);
        Assert.Equal(750m, r.TicketMedio);
    }

    // ---- helpers ----

    private static Produto Produto(long id, string nome, long empresaId, int estoque) => new()
    {
        Id = id,
        Uuid = Guid.NewGuid(),
        Nome = nome,
        Preco = 10m,
        QuantidadeEstoque = estoque,
        EmpresaId = empresaId
    };

    private static Servico Servico(long id, string descricao, TipoCobranca tipo, long empresaId) => new()
    {
        Id = id,
        Uuid = Guid.NewGuid(),
        Descricao = descricao,
        TipoCobranca = tipo,
        ValorHora = tipo == TipoCobranca.PorHora ? 100m : null,
        ValorEmpreitada = tipo == TipoCobranca.Empreitada ? 500m : null,
        EmpresaId = empresaId
    };

    private static void AddAtendimentoComProduto(AppDbContext db, long atId, long empresaId, StatusAtendimento status,
        decimal valorTotal, DateTime dataRegistro, params (long produtoId, int qtd, decimal subtotal)[] itens)
    {
        db.Atendimentos.Add(Atendimento(atId, empresaId, status, valorTotal, dataRegistro));
        foreach (var (produtoId, qtd, subtotal) in itens)
        {
            db.ItemProdutos.Add(new ItemProduto
            {
                Uuid = Guid.NewGuid(),
                AtendimentoId = atId,
                ProdutoId = produtoId,
                Quantidade = qtd,
                PrecoUnitario = qtd > 0 ? subtotal / qtd : 0m,
                Subtotal = subtotal
            });
        }
    }

    private static void AddAtendimentoComServico(AppDbContext db, long atId, long empresaId, StatusAtendimento status,
        decimal valorTotal, DateTime dataRegistro, params (long servicoId, int qtd, decimal subtotal)[] itens)
    {
        db.Atendimentos.Add(Atendimento(atId, empresaId, status, valorTotal, dataRegistro));
        foreach (var (servicoId, qtd, subtotal) in itens)
        {
            db.ItemServicos.Add(new ItemServico
            {
                Uuid = Guid.NewGuid(),
                AtendimentoId = atId,
                ServicoId = servicoId,
                Quantidade = qtd,
                PrecoUnitario = qtd > 0 ? subtotal / qtd : 0m,
                Subtotal = subtotal
            });
        }
    }

    private static Atendimento Atendimento(long id, long empresaId, StatusAtendimento status, decimal valorTotal, DateTime dataRegistro) => new()
    {
        Id = id,
        Uuid = Guid.NewGuid(),
        EmpresaId = empresaId,
        UsuarioId = 1,
        ClienteId = 1,
        Status = status,
        ValorTotal = valorTotal,
        DataRegistro = dataRegistro
    };

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }
}
