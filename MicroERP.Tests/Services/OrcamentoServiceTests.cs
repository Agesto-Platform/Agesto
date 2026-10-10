using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

public sealed class OrcamentoServiceTests
{
    [Fact]
    public async Task CreateAsync_NaoMexeEmEstoque_ECalculaValorTotal()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, estoque: 5, preco: 20m);
        await db.SaveChangesAsync();

        var service = BuildService(db);
        var request = new OrcamentoCreateRequest
        {
            ClienteId = 1,
            Status = StatusOrcamento.Rascunho,
            Itens = new List<ItemOrcamentoRequest>
            {
                new() { ProdutoId = 10, Quantidade = 2, PrecoUnitario = 30m },
                new() { Descricao = "Material avulso", Quantidade = 1, PrecoUnitario = 40m }
            }
        };

        var response = await service.CreateAsync(1, 7, request, CancellationToken.None);

        Assert.Equal(100m, response.ValorTotal); // 2*30 + 1*40
        Assert.Equal(2, response.Itens.Count);

        var produto = await db.Produtos.FindAsync(10L);
        Assert.Equal(5, produto!.QuantidadeEstoque); // estoque intacto (orcamento nao baixa)
    }

    [Fact]
    public async Task CreateAsync_ClienteInexistente_ThrowsNotFound()
    {
        await using var db = CreateContext();
        var service = BuildService(db);

        await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.NotFoundException>(() =>
            service.CreateAsync(1, 7, new OrcamentoCreateRequest
            {
                ClienteId = 99,
                Itens = new List<ItemOrcamentoRequest> { new() { ProdutoId = 1, Quantidade = 1, PrecoUnitario = 10m } }
            }, CancellationToken.None));
    }

    [Fact]
    public async Task ConverterAsync_QuandoAprovado_GeraAtendimentoEBaixaEstoque()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, estoque: 10, preco: 20m);
        db.Orcamentos.Add(new Orcamento
        {
            Id = 1,
            Uuid = Guid.NewGuid(),
            EmpresaId = 1,
            UsuarioId = 7,
            ClienteId = 1,
            Status = StatusOrcamento.Aprovado,
            DataRegistro = DateTime.UtcNow,
            ValorTotal = 115m,
            Itens = new List<ItemOrcamento>
            {
                new() { Uuid = Guid.NewGuid(), ProdutoId = 10, Quantidade = 3, PrecoUnitario = 25m, Subtotal = 75m },
                new() { Uuid = Guid.NewGuid(), Descricao = "Material avulso", Quantidade = 1, PrecoUnitario = 40m, Subtotal = 40m }
            }
        });
        await db.SaveChangesAsync();

        var service = BuildService(db);
        var atendimento = await service.ConverterAsync(1, 7, 1, CancellationToken.None);

        Assert.Equal(115m, atendimento.ValorTotal); // 3*25 (produto) + 40 (avulso)

        var produto = await db.Produtos.FindAsync(10L);
        Assert.Equal(7, produto!.QuantidadeEstoque); // 10 - 3 (avulso nao baixa)

        var orcamento = await db.Orcamentos.FindAsync(1L);
        Assert.Equal(atendimento.Id, orcamento!.AtendimentoConvertidoId);
    }

    [Fact]
    public async Task ConverterAsync_QuandoNaoAprovado_ThrowsArgumentException()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        db.Orcamentos.Add(new Orcamento
        {
            Id = 1,
            Uuid = Guid.NewGuid(),
            EmpresaId = 1,
            UsuarioId = 7,
            ClienteId = 1,
            Status = StatusOrcamento.Rascunho,
            DataRegistro = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var service = BuildService(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ConverterAsync(1, 7, 1, CancellationToken.None));
    }

    [Fact]
    public async Task ConverterAsync_QuandoJaConvertido_ThrowsArgumentException()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        db.Orcamentos.Add(new Orcamento
        {
            Id = 1,
            Uuid = Guid.NewGuid(),
            EmpresaId = 1,
            UsuarioId = 7,
            ClienteId = 1,
            Status = StatusOrcamento.Aprovado,
            DataRegistro = DateTime.UtcNow,
            AtendimentoConvertidoId = 99
        });
        await db.SaveChangesAsync();

        var service = BuildService(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.ConverterAsync(1, 7, 1, CancellationToken.None));
    }

    [Fact]
    public async Task GetAllAsync_IsolaPorEmpresa()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedCliente(db, id: 2, empresaId: 2);
        db.Orcamentos.AddRange(
            new Orcamento { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 7, ClienteId = 1, Status = StatusOrcamento.Rascunho, DataRegistro = DateTime.UtcNow },
            new Orcamento { Id = 2, Uuid = Guid.NewGuid(), EmpresaId = 2, UsuarioId = 8, ClienteId = 2, Status = StatusOrcamento.Rascunho, DataRegistro = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = BuildService(db);
        var daEmpresa1 = await service.GetAllAsync(1, CancellationToken.None);

        Assert.Single(daEmpresa1);
        Assert.Equal(1, daEmpresa1[0].Id);
    }

    [Fact]
    public async Task CreateAsync_ItemComProdutoEServico_ThrowsArgumentException()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();

        var service = BuildService(db);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateAsync(1, 7, new OrcamentoCreateRequest
            {
                ClienteId = 1,
                Itens = new List<ItemOrcamentoRequest>
                {
                    new() { ProdutoId = 10, ServicoId = 20, Quantidade = 1, PrecoUnitario = 10m }
                }
            }, CancellationToken.None));
    }

    // Rollback real: o provider InMemory ignora transacoes, entao este teste usa SQLite
    // relacional (in-memory) para provar que uma falha no meio da conversao desfaz tudo.
    [Fact]
    public async Task ConverterAsync_QuandoItemEstouraEstoque_FazRollbackCompleto()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        try
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection)
                .Options;

            await using (var seedDb = new AppDbContext(options))
            {
                await seedDb.Database.EnsureCreatedAsync();
                // SQLite valida FKs (diferente do InMemory): precisa da Empresa dona.
                seedDb.Empresas.Add(new Empresa { Id = 1, Nome = "Empresa Teste" });
                SeedCliente(seedDb, id: 1, empresaId: 1);
                seedDb.Produtos.Add(new Produto { Id = 10, Uuid = Guid.NewGuid(), Nome = "P", Preco = 10m, QuantidadeEstoque = 2, EmpresaId = 1 });
                seedDb.Orcamentos.Add(new Orcamento
                {
                    Id = 1,
                    Uuid = Guid.NewGuid(),
                    EmpresaId = 1,
                    UsuarioId = 7,
                    ClienteId = 1,
                    Status = StatusOrcamento.Aprovado,
                    DataRegistro = DateTime.UtcNow,
                    ValorTotal = 60m,
                    Itens = new List<ItemOrcamento>
                    {
                        new() { Uuid = Guid.NewGuid(), ProdutoId = 10, Quantidade = 1, PrecoUnitario = 10m, Subtotal = 10m }, // ok
                        new() { Uuid = Guid.NewGuid(), ProdutoId = 10, Quantidade = 5, PrecoUnitario = 10m, Subtotal = 50m }  // estoura (2 < 1+5)
                    }
                });
                await seedDb.SaveChangesAsync();
            }

            await using (var db = new AppDbContext(options))
            {
                var service = BuildService(db);
                await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.EstoqueInsuficienteException>(() =>
                    service.ConverterAsync(1, 7, 1, CancellationToken.None));
            }

            // Contexto novo para ler o estado real do banco apos o rollback.
            await using (var verifyDb = new AppDbContext(options))
            {
                Assert.Empty(await verifyDb.Atendimentos.ToListAsync());
                Assert.Empty(await verifyDb.ItemProdutos.ToListAsync());

                var produto = await verifyDb.Produtos.FirstAsync(p => p.Id == 10);
                Assert.Equal(2, produto.QuantidadeEstoque); // estoque intacto

                var orcamento = await verifyDb.Orcamentos.FirstAsync(o => o.Id == 1);
                Assert.Null(orcamento.AtendimentoConvertidoId); // nao marcou como convertido
            }
        }
        finally
        {
            connection.Close();
        }
    }

    [Fact]
    public async Task CreateAsync_ProdutoDeOutraEmpresa_ThrowsNotFound()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 20, empresaId: 2, estoque: 5, preco: 20m);
        await db.SaveChangesAsync();

        var request = new OrcamentoCreateRequest
        {
            ClienteId = 1,
            Itens = new List<ItemOrcamentoRequest> { new() { ProdutoId = 20, Quantidade = 1, PrecoUnitario = 10m } }
        };

        await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.NotFoundException>(() => BuildService(db).CreateAsync(1, 7, request, CancellationToken.None));
        Assert.Empty(db.Orcamentos);
    }

    // ---- helpers ----

    private static void SeedCliente(AppDbContext db, long id, long empresaId) =>
        db.Clientes.Add(new Cliente { Id = id, Uuid = Guid.NewGuid(), Nome = $"Cliente {id}", Cpf = $"cpf{id}", EmpresaId = empresaId });

    private static void SeedProduto(AppDbContext db, long id, long empresaId, int estoque, decimal preco) =>
        db.Produtos.Add(new Produto { Id = id, Uuid = Guid.NewGuid(), Nome = $"Produto {id}", Preco = preco, QuantidadeEstoque = estoque, EmpresaId = empresaId });

    private static OrcamentoService BuildService(AppDbContext db)
    {
        var clienteRepo = new ClienteRepository(db);
        var produtoRepo = new ProdutoRepository(db);
        var servicoRepo = new ServicoRepository(db);
        var atendimentoRepo = new AtendimentoRepository(db);
        var itemProdutoRepo = new ItemProdutoRepository(db);
        var itemServicoRepo = new ItemServicoRepository(db);
        var orcamentoRepo = new OrcamentoRepository(db);
        var configuracaoRepo = new ConfiguracaoRepository(db);

        var itemProdutoService = new ItemProdutoService(itemProdutoRepo, atendimentoRepo, produtoRepo, itemServicoRepo, configuracaoRepo);
        var itemServicoService = new ItemServicoService(itemServicoRepo, atendimentoRepo, servicoRepo, itemProdutoRepo);
        var atendimentoService = new AtendimentoService(atendimentoRepo, clienteRepo, itemProdutoRepo, itemServicoRepo, produtoRepo, configuracaoRepo);

        return new OrcamentoService(db, orcamentoRepo, clienteRepo, atendimentoService, itemProdutoService, itemServicoService);
    }

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
}
