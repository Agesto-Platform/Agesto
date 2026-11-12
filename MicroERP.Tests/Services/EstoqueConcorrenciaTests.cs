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

// Vendas simultâneas do mesmo produto (COD-03): cada requisição lê o saldo, baixa
// em memória e grava. Sem o token de concorrência em QuantidadeEstoque, a segunda
// gravação sobrescrevia a primeira. Aqui a "outra requisição" grava entre a leitura
// e o salvamento desta, num contexto separado, como no banco real.
public sealed class EstoqueConcorrenciaTests
{
    [Fact]
    public async Task ItemProduto_VendaSimultanea_SegundaFalhaSemPerderABaixaDaPrimeira()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10);

        await using var db = new AppDbContext(options);
        // esta requisição já leu o saldo (10)...
        Assert.Equal(10, (await db.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque);
        // ...e a outra vendeu 3 antes dela salvar
        await using (var outra = new AppDbContext(options))
            await BuildItemProduto(outra).CreateAsync(1, Item(quantidade: 3), CancellationToken.None);

        var ex = await Assert.ThrowsAsync<EstoqueAlteradoException>(() =>
            BuildItemProduto(db).CreateAsync(1, Item(quantidade: 4), CancellationToken.None));
        Assert.Equal(EstoqueAlteradoException.Mensagem, ex.Message);

        await using var verifyDb = new AppDbContext(options);
        Assert.Equal(7, (await verifyDb.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque); // 10 - 3, não 6
        Assert.Equal(new[] { 3 }, await verifyDb.ItemProdutos.Select(i => i.Quantidade).ToListAsync());

        // repetir com o saldo atualizado funciona
        await using (var retry = new AppDbContext(options))
            await BuildItemProduto(retry).CreateAsync(1, Item(quantidade: 4), CancellationToken.None);
        await using var finalDb = new AppDbContext(options);
        Assert.Equal(3, (await finalDb.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque);
    }

    [Fact]
    public async Task Descarga_VendaSimultanea_RecusaComMotivoEMantemPendente()
    {
        await using var connection = AbrirSqlite(out var options);
        await Seed(options, estoque: 10);

        await using var db = new AppDbContext(options);
        Assert.Equal(10, (await db.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque);
        await using (var outra = new AppDbContext(options))
            await BuildItemProduto(outra).CreateAsync(1, Item(quantidade: 3), CancellationToken.None);

        var uuid = Guid.NewGuid();
        var descarga = new SyncDescargaRequest
        {
            Atendimentos =
            [
                new AtendimentoSyncRequest
                {
                    Uuid = uuid,
                    ClienteId = 1,
                    Status = StatusAtendimento.Concluido,
                    DataRegistro = DateTime.UtcNow,
                    ItensProduto = [new ItemProdutoSyncRequest { Uuid = Guid.NewGuid(), ProdutoId = 10, Quantidade = 2 }]
                }
            ]
        };

        var res = await BuildSync(db).DescargaAsync(1, 1, descarga, CancellationToken.None);

        Assert.Empty(res.AtendimentosSincronizados); // continua pendente no device
        var recusa = Assert.Single(res.Recusas);
        Assert.Equal(uuid, recusa.Uuid);
        Assert.Contains("estoque de um produto mudou", recusa.Motivo);

        await using var verifyDb = new AppDbContext(options);
        Assert.Equal(7, (await verifyDb.Produtos.FirstAsync(p => p.Id == 10)).QuantidadeEstoque);
        Assert.False(await verifyDb.Atendimentos.AnyAsync(a => a.Uuid == uuid));
    }

    // ---- helpers ----

    private static ItemProdutoCreateRequest Item(int quantidade) =>
        new() { AtendimentoId = 50, ProdutoId = 10, Quantidade = quantidade };

    private static async Task Seed(DbContextOptions<AppDbContext> options, int estoque)
    {
        await using var db = new AppDbContext(options);
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Empresa Teste" });
        db.Usuarios.Add(new Usuario { Id = 1, Nome = "Dono", Email = "dono@teste.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono });
        db.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Cliente 1", Cpf = "cpf1", EmpresaId = 1 });
        db.Produtos.Add(new Produto { Id = 10, Uuid = Guid.NewGuid(), Nome = "Produto 10", Preco = 20m, QuantidadeEstoque = estoque, EmpresaId = 1 });
        db.Atendimentos.Add(new Atendimento
        {
            Id = 50,
            Uuid = Guid.NewGuid(),
            EmpresaId = 1,
            UsuarioId = 1,
            ClienteId = 1,
            Status = StatusAtendimento.Pendente,
            DataRegistro = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static ItemProdutoService BuildItemProduto(AppDbContext db) =>
        new(new ItemProdutoRepository(db), new AtendimentoRepository(db), new ProdutoRepository(db),
            new ItemServicoRepository(db), new ConfiguracaoRepository(db));

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
