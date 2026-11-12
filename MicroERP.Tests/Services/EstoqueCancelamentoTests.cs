using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

// E2E-03: a devolução usa a marca EstoqueBaixado do item, não a chave ControlaEstoque
// do momento. E2E-04: cancelar o atendimento devolve o estoque; sair de Cancelado
// baixa de novo, conferindo o saldo.
public sealed class EstoqueCancelamentoTests
{
    [Fact]
    public async Task ItemLancadoComChaveDesligada_ExcluidoDepoisDeReligar_NaoDevolve()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: false);
        await using var db = new AppDbContext(options);

        var item = await BuildItemProduto(db).CreateAsync(1, Item(4), CancellationToken.None);
        Assert.Equal(10, await Estoque(options));

        await LigarControle(options);
        await BuildItemProduto(db).DeleteAsync(1, item.Id, CancellationToken.None);

        Assert.Equal(10, await Estoque(options)); // antes do fix: 14
    }

    [Fact]
    public async Task AtendimentoComItemDaChaveDesligada_ExcluidoDepoisDeReligar_NaoDevolve()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: false);
        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(4), CancellationToken.None);

        await LigarControle(options);
        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).DeleteAsync(1, 50, CancellationToken.None);

        Assert.Equal(10, await Estoque(options));
    }

    [Fact]
    public async Task Cancelar_DevolveOEstoque_EExcluirDepoisNaoDevolveDeNovo()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: true);
        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(3), CancellationToken.None);
        Assert.Equal(7, await Estoque(options));

        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Cancelado), CancellationToken.None);
        Assert.Equal(10, await Estoque(options));

        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).DeleteAsync(1, 50, CancellationToken.None);
        Assert.Equal(10, await Estoque(options)); // não devolve duas vezes
    }

    [Fact]
    public async Task SairDeCancelado_BaixaDeNovo()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: true);
        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(3), CancellationToken.None);
        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Cancelado), CancellationToken.None);

        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Concluido), CancellationToken.None);

        Assert.Equal(7, await Estoque(options));
    }

    [Fact]
    public async Task SairDeCancelado_SemSaldo_RecusaEContinuaCancelado()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: true);
        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(3), CancellationToken.None);
        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Cancelado), CancellationToken.None);
        await using (var db = new AppDbContext(options))
        {
            (await db.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque = 2; // vendido em outro atendimento
            await db.SaveChangesAsync();
        }

        await using (var db = new AppDbContext(options))
            await Assert.ThrowsAsync<EstoqueInsuficienteException>(() =>
                BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Pendente), CancellationToken.None));

        await using var verifyDb = new AppDbContext(options);
        Assert.Equal(StatusAtendimento.Cancelado, (await verifyDb.Atendimentos.FirstAsync(a => a.Id == 50)).Status);
        Assert.Equal(2, await Estoque(options));
    }

    [Fact]
    public async Task ItemLancadoEmAtendimentoCancelado_NaoBaixaEstoque()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10, controlaEstoque: true);
        await using (var db = new AppDbContext(options))
            await BuildAtendimento(db).UpdateAsync(1, 50, Status(StatusAtendimento.Cancelado), CancellationToken.None);

        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(3), CancellationToken.None);

        Assert.Equal(10, await Estoque(options));
    }

    [Fact]
    public async Task ConclusaoCanceladaPeloApp_DevolveOEstoqueDosItensLancados()
    {
        await using var connection = AbrirSqlite(out var options);
        var uuid = await Seed(options, estoque: 10, controlaEstoque: true);
        await using (var db = new AppDbContext(options))
            await BuildItemProduto(db).CreateAsync(1, Item(3), CancellationToken.None); // lançado pelo Dono
        Assert.Equal(7, await Estoque(options));

        var descarga = new SyncDescargaRequest
        {
            Conclusoes = [new AtendimentoConclusaoSyncRequest { Uuid = uuid, Status = StatusAtendimento.Cancelado }]
        };
        await using (var db = new AppDbContext(options))
        {
            var res = await BuildSync(db).DescargaAsync(1, 1, descarga, CancellationToken.None);
            Assert.Equal([uuid], res.ConclusoesSincronizadas);
        }

        Assert.Equal(10, await Estoque(options));
    }

    // ---- helpers ----

    private static ItemProdutoCreateRequest Item(int quantidade) =>
        new() { AtendimentoId = 50, ProdutoId = 10, Quantidade = quantidade };

    private static AtendimentoUpdateRequest Status(StatusAtendimento status) => new() { Status = status };

    private static async Task<int> Estoque(DbContextOptions<AppDbContext> options)
    {
        await using var db = new AppDbContext(options);
        return (await db.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque;
    }

    private static async Task LigarControle(DbContextOptions<AppDbContext> options)
    {
        await using var db = new AppDbContext(options);
        (await db.Configuracoes.FirstAsync(c => c.EmpresaId == 1)).ControlaEstoque = true;
        await db.SaveChangesAsync();
    }

    private static async Task<Guid> Seed(DbContextOptions<AppDbContext> options, int estoque, bool controlaEstoque)
    {
        await using var db = new AppDbContext(options);
        var uuid = Guid.NewGuid();
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Empresa Teste" });
        db.Configuracoes.Add(new Configuracao { EmpresaId = 1, ControlaEstoque = controlaEstoque });
        db.Usuarios.Add(new Usuario { Id = 1, Nome = "Dono", Email = "dono@teste.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono });
        db.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Cliente 1", Cpf = "cpf1", EmpresaId = 1 });
        db.Produtos.Add(new Produto { Id = 10, Uuid = Guid.NewGuid(), Nome = "Produto 10", Preco = 20m, QuantidadeEstoque = estoque, EmpresaId = 1 });
        db.Atendimentos.Add(new Atendimento
        {
            Id = 50,
            Uuid = uuid,
            EmpresaId = 1,
            UsuarioId = 1,
            ClienteId = 1,
            Status = StatusAtendimento.Pendente,
            DataRegistro = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return uuid;
    }

    private static ItemProdutoService BuildItemProduto(AppDbContext db) =>
        new(new ItemProdutoRepository(db), new AtendimentoRepository(db), new ProdutoRepository(db),
            new ItemServicoRepository(db), new ConfiguracaoRepository(db));

    private static AtendimentoService BuildAtendimento(AppDbContext db) =>
        new(new AtendimentoRepository(db), new ClienteRepository(db), new ItemProdutoRepository(db),
            new ItemServicoRepository(db), new ProdutoRepository(db), new ConfiguracaoRepository(db), new UsuarioRepository(db));

    private static SyncService BuildSync(AppDbContext db)
    {
        var clienteRepo = new ClienteRepository(db);
        return new SyncService(
            db,
            new ClienteService(clienteRepo),
            clienteRepo,
            new ProdutoRepository(db),
            new ServicoRepository(db),
            new AtendimentoRepository(db),
            new ItemProdutoRepository(db),
            new ItemServicoRepository(db),
            NullLogger<SyncService>.Instance);
    }

    // SQLite relacional em memória, com o schema criado: vive enquanto a conexão estiver aberta.
    private static SqliteConnection AbrirSqlite(out DbContextOptions<AppDbContext> options)
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        using var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return connection;
    }
}
