using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;

namespace MicroERP.Tests.Repositories;

public sealed class AtendimentoRepositoryTests
{
    private static readonly DateTime De = new(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Ate = new(2026, 7, 31, 23, 59, 59, DateTimeKind.Utc);

    [Fact]
    public async Task GetAgendaAsync_FiltraPorPeriodoEmpresaEAgente()
    {
        await using var db = CreateContext();

        db.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Cliente 1", Cpf = "cpf1", EmpresaId = 1 });
        db.Atendimentos.AddRange(
            At(1, empresaId: 1, usuarioId: 5, agendada: new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc)),   // ok
            At(2, empresaId: 1, usuarioId: 5, agendada: new DateTime(2026, 8, 10, 9, 0, 0, DateTimeKind.Utc)),   // fora do periodo
            At(3, empresaId: 1, usuarioId: 5, agendada: null),                                                    // sem agenda
            At(4, empresaId: 2, usuarioId: 5, agendada: new DateTime(2026, 7, 12, 9, 0, 0, DateTimeKind.Utc)),   // outra empresa
            At(5, empresaId: 1, usuarioId: 9, agendada: new DateTime(2026, 7, 20, 9, 0, 0, DateTimeKind.Utc)));  // outro agente

        var deletado = At(6, empresaId: 1, usuarioId: 5, agendada: new DateTime(2026, 7, 25, 9, 0, 0, DateTimeKind.Utc));
        deletado.DeletedAt = DateTime.UtcNow;
        db.Atendimentos.Add(deletado);
        await db.SaveChangesAsync();

        var repo = new AtendimentoRepository(db);

        // Sem filtro de agente (Dono): empresa 1, no periodo, com DataAgendada, nao deletado -> ids 1 e 5
        var todos = await repo.GetAgendaAsync(1, De, Ate, null, CancellationToken.None);
        Assert.Equal(new long[] { 1, 5 }, todos.Select(a => a.Id).ToArray());

        // Filtrando pelo agente 5: só o id 1
        var doAgente = await repo.GetAgendaAsync(1, De, Ate, 5L, CancellationToken.None);
        Assert.Single(doAgente);
        Assert.Equal(1, doAgente[0].Id);
    }

    // PAG-02: o resumo da linha é o primeiro serviço vivo, senão o primeiro produto;
    // só da empresa. SQLite: as subconsultas precisam de SQL de verdade.
    [Fact]
    public async Task GetResumosAsync_PrimeiroServicoVivoSenaoProduto()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options;
        await using (var setup = new AppDbContext(options))
        {
            await setup.Database.EnsureCreatedAsync();
            setup.Empresas.AddRange(new Empresa { Id = 1, Nome = "Empresa" }, new Empresa { Id = 2, Nome = "Outra" });
            setup.Usuarios.Add(new Usuario { Id = 5, Nome = "Dono", Email = "d@t.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono });
            setup.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Cliente 1", Cpf = "cpf1", EmpresaId = 1 });
            setup.Servicos.AddRange(
                new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Removido", EmpresaId = 1 },
                new Servico { Id = 2, Uuid = Guid.NewGuid(), Descricao = "Instalação", EmpresaId = 1 },
                new Servico { Id = 3, Uuid = Guid.NewGuid(), Descricao = "Limpeza", EmpresaId = 1 });
            setup.Atendimentos.AddRange(
                At(1, empresaId: 1, usuarioId: 5, agendada: null),
                At(2, empresaId: 1, usuarioId: 5, agendada: null),
                At(3, empresaId: 1, usuarioId: 5, agendada: null),
                At(4, empresaId: 2, usuarioId: 5, agendada: null));
            setup.ItemServicos.AddRange(
                new ItemServico { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 1, ServicoId = 1, Quantidade = 1, DeletedAt = DateTime.UtcNow },
                new ItemServico { Id = 2, Uuid = Guid.NewGuid(), AtendimentoId = 1, ServicoId = 2, Quantidade = 1 },
                new ItemServico { Id = 3, Uuid = Guid.NewGuid(), AtendimentoId = 1, ServicoId = 3, Quantidade = 1 },
                new ItemServico { Id = 4, Uuid = Guid.NewGuid(), AtendimentoId = 4, ServicoId = 2, Quantidade = 1 });
            setup.ItemProdutos.Add(new ItemProduto { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 2, Descricao = "Filtro", Quantidade = 1 });
            await setup.SaveChangesAsync();
        }

        await using var db = new AppDbContext(options);
        var resumos = await new AtendimentoRepository(db).GetResumosAsync(1, [1, 2, 3, 4], CancellationToken.None);

        Assert.Equal(3, resumos.Count); // o 4 é de outra empresa
        Assert.Equal("Instalação", resumos[1]);
        Assert.Equal("Filtro", resumos[2]);
        Assert.Null(resumos[3]);
    }

    private static Atendimento At(long id, long empresaId, long usuarioId, DateTime? agendada) => new()
    {
        Id = id,
        Uuid = Guid.NewGuid(),
        EmpresaId = empresaId,
        UsuarioId = usuarioId,
        ClienteId = 1,
        Status = StatusAtendimento.Pendente,
        DataRegistro = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc),
        DataAgendada = agendada
    };

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
