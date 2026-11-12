using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Controllers;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Controllers;

// PAG-01 fase 3: as cinco listas do web são sempre paginadas. Sem parâmetros, a
// primeira página com 20 itens; o tamanho continua limitado a 100.
public sealed class PaginacaoControllerTests
{
    private const int Linhas = 25;

    [Fact]
    public async Task Clientes_SemParametros_DevolveAPrimeiraPaginaCom20()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new ClienteController(new ClienteService(new ClienteRepository(db))));

        var pagina = Pagina<ClienteResponse>(await controller.GetAll(new PaginacaoQuery(), new ClienteFiltroQuery(), CancellationToken.None));

        AssertPrimeiraPagina(pagina);
    }

    [Fact]
    public async Task Atendimentos_SemParametros_DevolveAPrimeiraPaginaCom20()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new AtendimentoController(BuildAtendimentoService(db)));

        var pagina = Pagina<AtendimentoResponse>(await controller.GetAll(new PaginacaoQuery(), new AtendimentoFiltroQuery(), CancellationToken.None));

        AssertPrimeiraPagina(pagina);
    }

    [Fact]
    public async Task Produtos_SemParametros_DevolveAPrimeiraPaginaCom20()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new ProdutoController(new ProdutoService(new ProdutoRepository(db))));

        var pagina = Pagina<ProdutoResponse>(await controller.GetAll(new PaginacaoQuery(), new ProdutoFiltroQuery(), CancellationToken.None));

        AssertPrimeiraPagina(pagina);
    }

    [Fact]
    public async Task Servicos_SemParametros_DevolveAPrimeiraPaginaCom20()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new ServicoController(
            new ServicoService(new ServicoRepository(db)), new Mock<IServicoSugeridoService>().Object));

        var pagina = Pagina<ServicoResponse>(await controller.GetAll(new PaginacaoQuery(), new ServicoFiltroQuery(), CancellationToken.None));

        AssertPrimeiraPagina(pagina);
    }

    [Fact]
    public async Task Orcamentos_SemParametros_DevolveAPrimeiraPaginaCom20()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new OrcamentoController(BuildOrcamentoService(db)));

        var pagina = Pagina<OrcamentoResponse>(await controller.GetAll(new PaginacaoQuery(), new OrcamentoFiltroQuery(), CancellationToken.None));

        AssertPrimeiraPagina(pagina);
        Assert.All(pagina.Itens, o => Assert.False(string.IsNullOrEmpty(o.ClienteNome)));
    }

    [Fact]
    public async Task Produtos_SegundaPagina_TrazOResto()
    {
        await using var db = await SeedAsync();
        var controller = Autenticado(new ProdutoController(new ProdutoService(new ProdutoRepository(db))));

        var pagina = Pagina<ProdutoResponse>(await controller.GetAll(new PaginacaoQuery { Pagina = 2 }, new ProdutoFiltroQuery(), CancellationToken.None));

        Assert.Equal((2, 20, Linhas), (pagina.Pagina, pagina.Tamanho, pagina.Total));
        Assert.Equal(Linhas - 20, pagina.Itens.Count);
    }

    // Funil da tela de Orçamentos: as quatro situações sempre presentes, só da empresa do token.
    [Fact]
    public async Task OrcamentoResumo_QuatroStatus_SoDaEmpresa_SemExcluidos()
    {
        await using var db = CreateContext();
        db.Clientes.AddRange(Cli(1, 1), Cli(2, 2));
        db.Orcamentos.AddRange(
            Orc(1, 1, 1, StatusOrcamento.Enviado, 100m),
            Orc(2, 1, 1, StatusOrcamento.Enviado, 50.5m),
            Orc(3, 1, 1, StatusOrcamento.Aprovado, 30m),
            Orc(4, 1, 1, StatusOrcamento.Aprovado, 999m, excluido: true),
            Orc(5, 2, 2, StatusOrcamento.Rascunho, 777m));
        await db.SaveChangesAsync();
        var controller = Autenticado(new OrcamentoController(BuildOrcamentoService(db)));

        var result = await controller.Resumo(CancellationToken.None);

        var body = Assert.IsType<ApiResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var resumo = Assert.IsAssignableFrom<IReadOnlyList<OrcamentoResumoResponse>>(body.Data);
        Assert.Equal(Enum.GetValues<StatusOrcamento>(), resumo.Select(r => r.Status));
        Assert.Equal((0, 0m), Linha(resumo, StatusOrcamento.Rascunho)); // o da empresa 2 não conta
        Assert.Equal((2, 150.5m), Linha(resumo, StatusOrcamento.Enviado));
        Assert.Equal((1, 30m), Linha(resumo, StatusOrcamento.Aprovado)); // o excluído não conta
        Assert.Equal((0, 0m), Linha(resumo, StatusOrcamento.Recusado));
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(null, 0)]
    [InlineData(null, 101)]
    public void PaginacaoQuery_ForaDosLimites_EhInvalida(int? pagina, int? tamanho)
    {
        var query = new PaginacaoQuery { Pagina = pagina, Tamanho = tamanho };
        Assert.False(Valido(query));
    }

    [Fact]
    public void PaginacaoQuery_SemNada_UsaPrimeiraPaginaCom20()
    {
        var query = new PaginacaoQuery();
        Assert.True(Valido(query));
        Assert.Equal(1, query.PaginaOuPadrao);
        Assert.Equal(PaginacaoQuery.TamanhoPadrao, query.TamanhoOuPadrao);
    }

    [Fact]
    public void PaginacaoQuery_SoTamanho_UsaPrimeiraPagina()
    {
        var query = new PaginacaoQuery { Tamanho = 50 };
        Assert.Equal(1, query.PaginaOuPadrao);
        Assert.Equal(50, query.TamanhoOuPadrao);
    }

    [Fact]
    public void Filtros_BuscaAcimaDe100Caracteres_SaoInvalidos()
    {
        var busca = new string('a', 101);
        Assert.False(Valido(new ProdutoFiltroQuery { Busca = busca }));
        Assert.False(Valido(new ServicoFiltroQuery { Busca = busca }));
        Assert.False(Valido(new OrcamentoFiltroQuery { Busca = busca }));
        Assert.True(Valido(new OrcamentoFiltroQuery { Busca = "joão", Status = StatusOrcamento.Aprovado }));
        Assert.False(Valido(new OrcamentoFiltroQuery { Status = (StatusOrcamento)42 }));
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("registro", true)]
    [InlineData("agendada", true)]
    [InlineData("xpto", false)]
    [InlineData("REGISTRO", false)]
    public void AtendimentoFiltro_Ordem_SoAceitaRegistroOuAgendada(string? ordem, bool valido)
    {
        Assert.Equal(valido, Valido(new AtendimentoFiltroQuery { Ordem = ordem }));
    }

    [Theory]
    [InlineData("3,8,15", new long[] { 3, 8, 15 })]
    [InlineData(" 3 , 8,8 ,", new long[] { 3, 8 })]
    public void ProdutoFiltro_Ids_LeAListaSeparadaPorVirgula(string ids, long[] esperados)
    {
        var filtro = new ProdutoFiltroQuery { Ids = ids };
        Assert.True(Valido(filtro));
        Assert.Equal(esperados, filtro.LerIds());
    }

    [Theory]
    [InlineData("3,abc")]
    [InlineData("0")]
    [InlineData("-4")]
    [InlineData(",")]
    public void ProdutoFiltro_IdsInvalidos_SaoRejeitados(string ids)
    {
        Assert.False(Valido(new ProdutoFiltroQuery { Ids = ids }));
    }

    [Fact]
    public void ProdutoFiltro_MaisDe100Ids_EhRejeitado()
    {
        Assert.True(Valido(new ProdutoFiltroQuery { Ids = string.Join(',', Enumerable.Range(1, 100)) }));
        Assert.False(Valido(new ProdutoFiltroQuery { Ids = string.Join(',', Enumerable.Range(1, 101)) }));
    }

    [Fact]
    public void ProdutoFiltro_SemIds_NaoFiltra()
    {
        Assert.Null(new ProdutoFiltroQuery().LerIds());
        Assert.Null(new ProdutoFiltroQuery { Ids = "  " }.LerIds());
    }

    // ---- helpers ----

    private static void AssertPrimeiraPagina<T>(PaginaResponse<T> pagina)
    {
        Assert.Equal((1, PaginacaoQuery.TamanhoPadrao, Linhas), (pagina.Pagina, pagina.Tamanho, pagina.Total));
        Assert.Equal(PaginacaoQuery.TamanhoPadrao, pagina.Itens.Count);
    }

    private static PaginaResponse<T> Pagina<T>(ActionResult<ApiResponse> result)
    {
        var body = Assert.IsType<ApiResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        return Assert.IsType<PaginaResponse<T>>(body.Data);
    }

    private static (int, decimal) Linha(IReadOnlyList<OrcamentoResumoResponse> resumo, StatusOrcamento status)
    {
        var linha = resumo.Single(r => r.Status == status);
        return (linha.Quantidade, linha.ValorTotal);
    }

    private static bool Valido(object objeto) =>
        Validator.TryValidateObject(objeto, new ValidationContext(objeto), [], validateAllProperties: true);

    // 25 linhas de cada lista na empresa 1, mais uma da empresa 2 que nunca pode aparecer.
    private static async Task<AppDbContext> SeedAsync()
    {
        var db = CreateContext();
        for (var i = 1; i <= Linhas; i++)
        {
            db.Clientes.Add(Cli(i, 1));
            db.Produtos.Add(new Produto { Id = i, Uuid = Guid.NewGuid(), Nome = $"Produto {i:00}", EmpresaId = 1 });
            db.Servicos.Add(new Servico { Id = i, Uuid = Guid.NewGuid(), Descricao = $"Serviço {i:00}", EmpresaId = 1 });
            db.Orcamentos.Add(Orc(i, 1, i, StatusOrcamento.Rascunho, 10m));
            db.Atendimentos.Add(new Atendimento { Id = i, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 5, ClienteId = i, DataRegistro = DateTime.UtcNow.AddDays(-i) });
        }
        db.Clientes.Add(Cli(100, 2));
        db.Produtos.Add(new Produto { Id = 100, Uuid = Guid.NewGuid(), Nome = "Outra", EmpresaId = 2 });
        db.Servicos.Add(new Servico { Id = 100, Uuid = Guid.NewGuid(), Descricao = "Outra", EmpresaId = 2 });
        db.Orcamentos.Add(Orc(100, 2, 100, StatusOrcamento.Rascunho, 10m));
        db.Atendimentos.Add(new Atendimento { Id = 100, Uuid = Guid.NewGuid(), EmpresaId = 2, UsuarioId = 6, ClienteId = 100, DataRegistro = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return db;
    }

    private static Cliente Cli(long id, long empresaId) =>
        new() { Id = id, Uuid = Guid.NewGuid(), Nome = $"Cliente {id:00}", Cpf = $"cpf{id}", EmpresaId = empresaId };

    private static Orcamento Orc(long id, long empresaId, long clienteId, StatusOrcamento status, decimal valor, bool excluido = false) => new()
    {
        Id = id,
        Uuid = Guid.NewGuid(),
        EmpresaId = empresaId,
        UsuarioId = 5,
        ClienteId = clienteId,
        Status = status,
        ValorTotal = valor,
        DataRegistro = DateTime.UtcNow.AddDays(-id),
        DeletedAt = excluido ? DateTime.UtcNow : null
    };

    private static AtendimentoService BuildAtendimentoService(AppDbContext db) =>
        new(new AtendimentoRepository(db), new ClienteRepository(db), new ItemProdutoRepository(db), new ItemServicoRepository(db),
            new ProdutoRepository(db), new ConfiguracaoRepository(db), new UsuarioRepository(db));

    private static OrcamentoService BuildOrcamentoService(AppDbContext db)
    {
        var atendimentoRepo = new AtendimentoRepository(db);
        var itemProdutoRepo = new ItemProdutoRepository(db);
        var itemServicoRepo = new ItemServicoRepository(db);
        var produtoRepo = new ProdutoRepository(db);
        return new OrcamentoService(db, new OrcamentoRepository(db), new ClienteRepository(db), BuildAtendimentoService(db),
            new ItemProdutoService(itemProdutoRepo, atendimentoRepo, produtoRepo, itemServicoRepo, new ConfiguracaoRepository(db)),
            new ItemServicoService(itemServicoRepo, atendimentoRepo, new ServicoRepository(db), itemProdutoRepo));
    }

    private static T Autenticado<T>(T controller) where T : ControllerBase
    {
        var identity = new ClaimsIdentity([new Claim("empresaId", "1"), new Claim("sub", "5"), new Claim("perfil", "Dono")], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
}
