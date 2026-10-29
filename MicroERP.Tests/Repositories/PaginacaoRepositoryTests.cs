using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;

namespace MicroERP.Tests.Repositories;

public sealed class PaginacaoRepositoryTests
{
    [Fact]
    public async Task GetPaginaAsync_TrazSoAPaginaEOTotalDaEmpresaSemDeletados()
    {
        await using var db = CreateContext();

        // 25 clientes da empresa 1 com nomes "Cliente 01".."Cliente 25"
        for (var i = 1; i <= 25; i++)
            db.Clientes.Add(Cli(i, empresaId: 1, nome: $"Cliente {i:00}"));
        db.Clientes.Add(Cli(100, empresaId: 2, nome: "Outra empresa"));
        var deletado = Cli(101, empresaId: 1, nome: "Cliente 00 deletado");
        deletado.DeletedAt = DateTime.UtcNow;
        db.Clientes.Add(deletado);
        await db.SaveChangesAsync();

        var repo = new ClienteRepository(db);

        var (pagina2, total) = await repo.GetPaginaAsync(1, pagina: 2, tamanho: 10, CancellationToken.None);
        Assert.Equal(25, total);
        Assert.Equal(Enumerable.Range(11, 10).Select(i => $"Cliente {i:00}"), pagina2.Select(c => c.Nome));

        var (pagina3, _) = await repo.GetPaginaAsync(1, pagina: 3, tamanho: 10, CancellationToken.None);
        Assert.Equal(5, pagina3.Count);

        var (alemDoFim, totalAlem) = await repo.GetPaginaAsync(1, pagina: 9, tamanho: 10, CancellationToken.None);
        Assert.Empty(alemDoFim);
        Assert.Equal(25, totalAlem);
    }

    [Fact]
    public async Task GetPaginaAsync_NomesIguais_DesempataPeloId()
    {
        await using var db = CreateContext();
        db.Clientes.AddRange(Cli(3, 1, "Ana"), Cli(1, 1, "Ana"), Cli(2, 1, "Ana"));
        await db.SaveChangesAsync();

        var repo = new ClienteRepository(db);
        var (p1, _) = await repo.GetPaginaAsync(1, 1, 2, CancellationToken.None);
        var (p2, _) = await repo.GetPaginaAsync(1, 2, 2, CancellationToken.None);

        Assert.Equal(new long[] { 1, 2, 3 }, p1.Concat(p2).Select(c => c.Id));
    }

    private static Cliente Cli(long id, long empresaId, string nome) =>
        new() { Id = id, Uuid = Guid.NewGuid(), Nome = nome, Cpf = $"cpf{id}", EmpresaId = empresaId };

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
