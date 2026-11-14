using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Repositories;

// Agenda com histórico (o registrado sem agendamento entra no dia do registro) e os
// avisos do sino: pendentes de hoje e atrasados. SQLite: SQL de verdade.
public sealed class AgendaHistoricoAvisosTests
{
    private static readonly DateTime De = new(2026, 11, 1, 3, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Ate = new(2026, 12, 1, 2, 59, 59, DateTimeKind.Utc);

    [Fact]
    public async Task Agenda_ComHistorico_IncluiORegistradoSemAgendamento_SemHistoricoNao()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);
        var repo = new AtendimentoRepository(db);

        var comHistorico = await repo.GetAgendaAsync(1, De, Ate, null, historico: true, CancellationToken.None);
        var semHistorico = await repo.GetAgendaAsync(1, De, Ate, null, historico: false, CancellationToken.None);

        // 3: registrado em 05/11 sem agendamento; ordem pela data de referência; todos
        // os status (é histórico), sem o excluído (7) nem o de outra empresa (8)
        Assert.Equal([3, 6, 2, 1, 4, 5], comHistorico.Select(a => a.Id).ToArray());
        Assert.Equal([6, 2, 1, 4, 5], semHistorico.Select(a => a.Id).ToArray());
    }

    [Fact]
    public async Task Pendentes_DeHoje_EAtrasados_DoMaisRecente()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);
        var repo = new AtendimentoRepository(db);
        var inicioHoje = new DateTime(2026, 11, 14, 3, 0, 0, DateTimeKind.Utc); // 00:00 em Brasília

        var hoje = await repo.GetPendentesAgendadosAsync(1, inicioHoje, inicioHoje.AddDays(1), null, 50, CancellationToken.None);
        var atrasados = await repo.GetPendentesAgendadosAsync(1, null, inicioHoje, null, 50, CancellationToken.None);
        var umAtrasado = await repo.GetPendentesAgendadosAsync(1, null, inicioHoje, null, 1, CancellationToken.None);
        var totalAtrasados = await repo.ContarPendentesAgendadosAsync(1, null, inicioHoje, null, CancellationToken.None);
        var doAgente9 = await repo.GetPendentesAgendadosAsync(1, inicioHoje, inicioHoje.AddDays(1), 9, 50, CancellationToken.None);

        Assert.Equal([4], hoje.Select(a => a.Id).ToArray());              // o concluído de hoje não entra
        Assert.Equal([1, 2], atrasados.Select(a => a.Id).ToArray());       // 12/11 antes de 10/11; sem o cancelado
        Assert.Equal([1], umAtrasado.Select(a => a.Id).ToArray());
        Assert.Equal(2, totalAtrasados);
        Assert.Empty(doAgente9);
    }

    [Fact]
    public async Task Avisos_UsamODiaDeBrasilia()
    {
        await using var connection = AbrirSqlite(out var options);
        await SeedAsync(options);
        await using var db = new AppDbContext(options);
        // 14/11 às 01:30 em Brasília = 04:30 UTC; às 02:30 UTC ainda seria 13/11 lá.
        var service = BuildService(db, new DateTimeOffset(2026, 11, 14, 4, 30, 0, TimeSpan.Zero));

        var avisos = await service.GetAvisosAsync(1, null, CancellationToken.None);

        Assert.Equal([4], avisos.Hoje.Select(a => a.Id).ToArray());
        Assert.Equal("Vó Joana", avisos.Hoje[0].ClienteNome);
        Assert.Equal([1, 2], avisos.Atrasados.Select(a => a.Id).ToArray());
        Assert.Equal(2, avisos.TotalAtrasados);
    }

    // Empresa 1, agente 5:
    // 1 pendente agendado 12/11 (atrasado), 2 pendente agendado 10/11 (atrasado),
    // 3 concluído registrado 05/11 sem agendamento (histórico), 4 pendente hoje 14/11 10h,
    // 5 concluído hoje, 6 cancelado 09/11, 7 excluído hoje, 8 de outra empresa hoje.
    private static async Task SeedAsync(DbContextOptions<AppDbContext> options)
    {
        await using var db = new AppDbContext(options);
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "Empresa" }, new Empresa { Id = 2, Nome = "Outra" });
        db.Usuarios.Add(new Usuario { Id = 5, Nome = "Agente", Email = "a@t.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Agente });
        db.Clientes.AddRange(
            new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Vó Joana", Cpf = "1", EmpresaId = 1 },
            new Cliente { Id = 2, Uuid = Guid.NewGuid(), Nome = "Outra", Cpf = "2", EmpresaId = 2 });
        db.Atendimentos.AddRange(
            At(1, StatusAtendimento.Pendente, Utc(2026, 11, 2, 9), Utc(2026, 11, 12, 13)),
            At(2, StatusAtendimento.Pendente, Utc(2026, 11, 2, 9), Utc(2026, 11, 10, 13)),
            At(3, StatusAtendimento.Concluido, Utc(2026, 11, 5, 15), null),
            At(4, StatusAtendimento.Pendente, Utc(2026, 11, 2, 9), Utc(2026, 11, 14, 13)),
            At(5, StatusAtendimento.Concluido, Utc(2026, 11, 2, 9), Utc(2026, 11, 14, 15)),
            At(6, StatusAtendimento.Cancelado, Utc(2026, 11, 2, 9), Utc(2026, 11, 9, 13)),
            At(7, StatusAtendimento.Pendente, Utc(2026, 11, 2, 9), Utc(2026, 11, 14, 16), excluido: true),
            At(8, StatusAtendimento.Pendente, Utc(2026, 11, 2, 9), Utc(2026, 11, 14, 13), empresaId: 2, clienteId: 2));
        await db.SaveChangesAsync();
    }

    private static DateTime Utc(int y, int m, int d, int h) => new(y, m, d, h, 0, 0, DateTimeKind.Utc);

    private static Atendimento At(long id, StatusAtendimento status, DateTime registro, DateTime? agendada,
        bool excluido = false, long empresaId = 1, long clienteId = 1) => new()
        {
            Id = id,
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,
            UsuarioId = 5,
            ClienteId = clienteId,
            Status = status,
            DataRegistro = registro,
            DataAgendada = agendada,
            DeletedAt = excluido ? DateTime.UtcNow : null
        };

    private static AtendimentoService BuildService(AppDbContext db, DateTimeOffset agora) =>
        new(new AtendimentoRepository(db), new ClienteRepository(db), new ItemProdutoRepository(db),
            new ItemServicoRepository(db), new ProdutoRepository(db), new ConfiguracaoRepository(db),
            new UsuarioRepository(db), new RelogioFixo(agora));

    private sealed class RelogioFixo(DateTimeOffset agora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => agora;
    }

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
