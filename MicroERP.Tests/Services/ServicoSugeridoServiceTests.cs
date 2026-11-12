using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

public sealed class ServicoSugeridoServiceTests
{
    private static AppDbContext CreateContext()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        db.Servicos.Add(new Servico { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = 1, Descricao = "Instalacao de lava-roupas" });
        db.Servicos.Add(new Servico { Id = 2, Uuid = Guid.NewGuid(), EmpresaId = 2, Descricao = "Servico de outra empresa" });
        db.Produtos.Add(new Produto { Id = 10, Uuid = Guid.NewGuid(), EmpresaId = 1, Nome = "T 25mm", Preco = 3m });
        db.Produtos.Add(new Produto { Id = 11, Uuid = Guid.NewGuid(), EmpresaId = 1, Nome = "Cotovelo 90", Preco = 2m });
        db.SaveChanges();
        return db;
    }

    private static ServicoSugeridoService Build(AppDbContext db) =>
        new(new ServicoSugeridoRepository(db), new ServicoRepository(db), new ProdutoRepository(db));

    [Fact]
    public async Task ReplaceAsync_SetsKitAndGetReturnsIt()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        var res = await svc.ReplaceAsync(1, 1,
        [
            new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 2 },
            new ServicoSugeridoRequest { ProdutoId = 11, QuantidadePadrao = 1 },
        ], CancellationToken.None);

        Assert.Equal(2, res.Count);
        Assert.Equal(3m, res.Single(r => r.ProdutoId == 10).ProdutoPreco); // PAG-01: preço para lançar o kit

        var got = await svc.GetByServicoAsync(1, 1, CancellationToken.None);
        Assert.Equal(2, got.Count);
        var t = got.Single(g => g.ProdutoId == 10);
        Assert.Equal("T 25mm", t.ProdutoNome);
        Assert.Equal(3m, t.ProdutoPreco);
        Assert.Equal(2, t.QuantidadePadrao);
    }

    [Fact]
    public async Task ReplaceAsync_UnknownProduto_Throws()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            svc.ReplaceAsync(1, 1, [new ServicoSugeridoRequest { ProdutoId = 999, QuantidadePadrao = 1 }], CancellationToken.None));
    }

    [Fact]
    public async Task ReplaceAsync_UnknownServico_Throws()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            svc.ReplaceAsync(1, 99, [new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 1 }], CancellationToken.None));
    }

    [Fact]
    public async Task ReplaceAsync_ServicoDeOutraEmpresa_Throws()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        // Servico 2 é da empresa 2; a empresa 1 não pode montar seu kit.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            svc.ReplaceAsync(1, 2, [new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 1 }], CancellationToken.None));
    }

    [Fact]
    public async Task ReplaceAsync_DedupaProdutoRepetido_UltimaQuantidadeVence()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        await svc.ReplaceAsync(1, 1,
        [
            new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 2 },
            new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 5 },
        ], CancellationToken.None);

        var got = await svc.GetByServicoAsync(1, 1, CancellationToken.None);
        Assert.Single(got);
        Assert.Equal(5, got[0].QuantidadePadrao);
    }

    [Fact]
    public async Task ReplaceAsync_SubstituiConjunto_NaoAcumula()
    {
        await using var db = CreateContext();
        var svc = Build(db);

        await svc.ReplaceAsync(1, 1, [new ServicoSugeridoRequest { ProdutoId = 10, QuantidadePadrao = 1 }], CancellationToken.None);
        await svc.ReplaceAsync(1, 1, [new ServicoSugeridoRequest { ProdutoId = 11, QuantidadePadrao = 3 }], CancellationToken.None);

        var got = await svc.GetByServicoAsync(1, 1, CancellationToken.None);
        Assert.Single(got);
        Assert.Equal(11, got[0].ProdutoId);
    }
}
