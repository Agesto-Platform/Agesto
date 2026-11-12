using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;

namespace MicroERP.Tests.Repositories;

// PAG-01 fases 2 e 3: busca e filtros de Produtos, Serviços e Orçamentos no banco.
// SQLite com a função translate igual à do Postgres, para exercitar o SQL de verdade.
public sealed class BuscaCatalogoTests
{
    [Theory]
    [InlineData("valvula", new long[] { 1, 2 })]   // sem acento acha "Válvula"
    [InlineData("VÁLV", new long[] { 1, 2 })]      // maiúsculas e acento no termo
    [InlineData("pressao", new long[] { 1 })]
    [InlineData("filtro", new long[] { 3 })]
    [InlineData("outra", new long[0])]             // "Válvula outra" é da empresa 2
    [InlineData("excluida", new long[0])]          // excluído não aparece
    public async Task Produtos_Busca_SemAcentoSoDaEmpresa(string busca, long[] esperados)
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new ProdutoRepository(db).GetPaginaAsync(1, 1, 50, busca, null, CancellationToken.None);

        Assert.Equal(esperados, itens.Select(p => p.Id).Order().ToArray());
        Assert.Equal(esperados.Length, total);
    }

    // Filtro "Atenção": só os ids pedidos, nunca de outra empresa nem excluídos.
    [Fact]
    public async Task Produtos_Ids_SoOsPedidosDaEmpresa()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);
        var repo = new ProdutoRepository(db);

        var (itens, total) = await repo.GetPaginaAsync(1, 1, 50, null, [1, 3, 4, 9], CancellationToken.None);
        Assert.Equal(new long[] { 1, 3 }, itens.Select(p => p.Id).Order().ToArray());
        Assert.Equal(2, total);

        var (soOutra, totalOutra) = await repo.GetPaginaAsync(1, 1, 50, null, [9], CancellationToken.None);
        Assert.Empty(soOutra);
        Assert.Equal(0, totalOutra);

        var (comBusca, _) = await repo.GetPaginaAsync(1, 1, 50, "valvula", [1, 3], CancellationToken.None);
        Assert.Equal(new long[] { 1 }, comBusca.Select(p => p.Id).ToArray());
    }

    [Theory]
    [InlineData("instalacao", null, new long[] { 1, 2 })]
    [InlineData("ELÉTRICA", null, new long[] { 2 })]
    [InlineData(null, false, new long[] { 2, 3 })]           // a revisar (o total vira o contador do web)
    [InlineData(null, true, new long[] { 1 })]
    [InlineData("instal", false, new long[] { 2 })]
    [InlineData("outra", null, new long[0])]                 // da empresa 2
    [InlineData(null, null, new long[] { 1, 2, 3 })]         // sem o excluído
    public async Task Servicos_BuscaERevisado_SoDaEmpresa(string? busca, bool? revisado, long[] esperados)
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new ServicoRepository(db).GetPaginaAsync(1, 1, 50, busca, revisado, CancellationToken.None);

        Assert.Equal(esperados, itens.Select(s => s.Id).Order().ToArray());
        Assert.Equal(esperados.Length, total);
    }

    [Fact]
    public async Task Servicos_ARevisar_TrazQuemCriou()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, _) = await new ServicoRepository(db).GetPaginaAsync(1, 1, 50, null, false, CancellationToken.None);

        Assert.Equal("Agente", itens.Single(s => s.Id == 2).CriadoPor?.Nome);
    }

    [Theory]
    [InlineData("joao", null, new long[] { 12, 10 })]                        // nome do cliente, sem acento
    [InlineData("MARINA", null, new long[] { 11 })]
    [InlineData(null, StatusOrcamento.Aprovado, new long[] { 11 })]
    [InlineData("joao", StatusOrcamento.Enviado, new long[] { 10 })]
    [InlineData("outra", null, new long[0])]                                 // cliente da empresa 2
    [InlineData(null, null, new long[] { 12, 11, 10 })]                      // mais recente primeiro; empate pelo id maior
    public async Task Orcamentos_BuscaPeloClienteEStatus_OrdemDaTela(string? busca, StatusOrcamento? status, long[] esperados)
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);

        var (itens, total) = await new OrcamentoRepository(db).GetPaginaAsync(1, 1, 50, busca, status, CancellationToken.None);

        Assert.Equal(esperados, itens.Select(o => o.Id).ToArray());
        Assert.Equal(esperados.Length, total);
        Assert.All(itens, o => Assert.NotNull(o.Cliente)); // o nome vem junto, sem lista de clientes
    }

    // Rótulos dos itens em lote: inclui produto/serviço excluído; nunca o de outra empresa.
    [Fact]
    public async Task Orcamentos_RotulosDosItens_SoDaEmpresaComExcluidos()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);
        var repo = new OrcamentoRepository(db);
        var (itens, _) = await repo.GetPaginaAsync(1, 1, 50, null, null, CancellationToken.None);

        var rotulos = await repo.GetRotulosDosItensAsync(1, itens.SelectMany(o => o.Itens), CancellationToken.None);

        Assert.Equal("Válvula de pressão", rotulos.Produtos[1]);
        Assert.Equal("Válvula excluída", rotulos.Produtos[4]);
        Assert.False(rotulos.Produtos.ContainsKey(9));
        Assert.Equal(("Instalação elétrica", TipoCobranca.Empreitada), rotulos.Servicos[2]);
        Assert.False(rotulos.Servicos.ContainsKey(9));
    }

    // Produtos: 1 "Válvula de pressão", 2 "Valvula simples", 3 "Filtro", 4 excluído; 9 da empresa 2.
    // Serviços: 1 revisado, 2 e 3 a revisar (2 criado pelo agente), 4 excluído; 9 da empresa 2.
    // Orçamentos: 10 João enviado, 11 Marina aprovado, 12 João rascunho (mesmo dia do 11),
    // 13 João excluído; 90 da empresa 2. O 10 tem itens de produto/serviço, um de outra empresa.
    private static async Task SeedAsync(DbContextOptions<AppDbContext> options)
    {
        await using var db = new AppDbContext(options);
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "Empresa" }, new Empresa { Id = 2, Nome = "Outra" });
        db.Usuarios.AddRange(
            new Usuario { Id = 5, Nome = "Dono", Email = "d@t.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono },
            new Usuario { Id = 6, Nome = "Agente", Email = "a@t.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Agente },
            new Usuario { Id = 7, Nome = "Dono 2", Email = "d2@t.com", Senha = "x", EmpresaId = 2, Perfil = PerfilUsuario.Dono });
        db.Produtos.AddRange(
            new Produto { Id = 1, Uuid = Guid.NewGuid(), Nome = "Válvula de pressão", EmpresaId = 1 },
            new Produto { Id = 2, Uuid = Guid.NewGuid(), Nome = "Valvula simples", EmpresaId = 1 },
            new Produto { Id = 3, Uuid = Guid.NewGuid(), Nome = "Filtro", EmpresaId = 1 },
            new Produto { Id = 4, Uuid = Guid.NewGuid(), Nome = "Válvula excluída", EmpresaId = 1, DeletedAt = DateTime.UtcNow },
            new Produto { Id = 9, Uuid = Guid.NewGuid(), Nome = "Válvula outra", EmpresaId = 2 });
        db.Servicos.AddRange(
            new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Instalação de ar", EmpresaId = 1, Revisado = true },
            new Servico { Id = 2, Uuid = Guid.NewGuid(), Descricao = "Instalação elétrica", TipoCobranca = TipoCobranca.Empreitada, EmpresaId = 1, Revisado = false, CriadoPorUsuarioId = 6 },
            new Servico { Id = 3, Uuid = Guid.NewGuid(), Descricao = "Limpeza", EmpresaId = 1, Revisado = false },
            new Servico { Id = 4, Uuid = Guid.NewGuid(), Descricao = "Instalação excluída", EmpresaId = 1, Revisado = false, DeletedAt = DateTime.UtcNow },
            new Servico { Id = 9, Uuid = Guid.NewGuid(), Descricao = "Instalação outra", EmpresaId = 2, Revisado = false });
        db.Clientes.AddRange(
            new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "João Silva", Cpf = "1", EmpresaId = 1 },
            new Cliente { Id = 2, Uuid = Guid.NewGuid(), Nome = "Marina", Cpf = "2", EmpresaId = 1 },
            new Cliente { Id = 9, Uuid = Guid.NewGuid(), Nome = "João de Outra", Cpf = "9", EmpresaId = 2 });
        db.Orcamentos.AddRange(
            Orc(10, 1, StatusOrcamento.Enviado, new(2026, 11, 1, 9, 0, 0)),
            Orc(11, 2, StatusOrcamento.Aprovado, new(2026, 11, 3, 9, 0, 0)),
            Orc(12, 1, StatusOrcamento.Rascunho, new(2026, 11, 3, 9, 0, 0)),
            Orc(13, 1, StatusOrcamento.Rascunho, new(2026, 11, 9, 9, 0, 0), excluido: true),
            Orc(90, 9, StatusOrcamento.Enviado, new(2026, 11, 9, 9, 0, 0), empresaId: 2));
        db.ItemOrcamentos.AddRange(
            new ItemOrcamento { Id = 1, Uuid = Guid.NewGuid(), OrcamentoId = 10, ProdutoId = 1, Quantidade = 1 },
            new ItemOrcamento { Id = 2, Uuid = Guid.NewGuid(), OrcamentoId = 10, ProdutoId = 4, Quantidade = 1 },
            new ItemOrcamento { Id = 3, Uuid = Guid.NewGuid(), OrcamentoId = 10, ServicoId = 2, Quantidade = 1 },
            new ItemOrcamento { Id = 4, Uuid = Guid.NewGuid(), OrcamentoId = 10, ProdutoId = 9, Quantidade = 1 },
            new ItemOrcamento { Id = 5, Uuid = Guid.NewGuid(), OrcamentoId = 10, ServicoId = 9, Quantidade = 1 });
        await db.SaveChangesAsync();
    }

    private static Orcamento Orc(long id, long clienteId, StatusOrcamento status, DateTime registro,
        bool excluido = false, long empresaId = 1) => new()
        {
            Id = id,
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,
            UsuarioId = empresaId == 1 ? 5 : 7,
            ClienteId = clienteId,
            Status = status,
            DataRegistro = registro,
            DeletedAt = excluido ? DateTime.UtcNow : null
        };

    private static SqliteConnection AbrirSqlite(out DbContextOptions<AppDbContext> options)
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        connection.CreateFunction("translate", (string? texto, string de, string para) => FuncoesSql.TranslateEmMemoria(texto, de, para));
        options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        using var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return connection;
    }
}
