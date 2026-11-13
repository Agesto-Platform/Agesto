using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Insights;

namespace MicroERP.Tests.Services;

// Limite diário de perguntas ao Agente (DEC-21), com o SQL de verdade (SQLite).
public sealed class UsoIaServiceTests : IAsyncLifetime
{
    private readonly SqliteConnection _conexao = new("DataSource=:memory:");
    private readonly RelogioFixo _relogio = new(new DateTimeOffset(2026, 11, 13, 15, 0, 0, TimeSpan.Zero));

    public async Task InitializeAsync()
    {
        await _conexao.OpenAsync();
        await using var db = Contexto();
        await db.Database.EnsureCreatedAsync();
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "Empresa" }, new Empresa { Id = 2, Nome = "Outra" });
        await db.SaveChangesAsync();
    }

    public async Task DisposeAsync() => await _conexao.DisposeAsync();

    private AppDbContext Contexto() => new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conexao).Options);

    private UsoIaService Servico(AppDbContext db, int limite = 3) =>
        new(db, Options.Create(new InsightsOptions { PerguntasPorDia = limite }), _relogio);

    [Fact]
    public async Task Reservar_ContaAteOLimiteEDepoisRecusa()
    {
        await using var db = Contexto();
        var servico = Servico(db, limite: 3);

        Assert.Equal(2, await servico.ReservarPerguntaAsync(1, CancellationToken.None));
        Assert.Equal(1, await servico.ReservarPerguntaAsync(1, CancellationToken.None));
        Assert.Equal(0, await servico.ReservarPerguntaAsync(1, CancellationToken.None));
        var ex = await Assert.ThrowsAsync<LimiteIaExcedidoException>(() => servico.ReservarPerguntaAsync(1, CancellationToken.None));
        Assert.Contains("3 perguntas de hoje", ex.Message);

        var uso = await servico.ObterHojeAsync(1, CancellationToken.None);
        Assert.Equal((3, 3, 0), (uso.Limite, uso.Usadas, uso.Restantes));
    }

    [Fact]
    public async Task Reservar_CadaEmpresaTemOProprioLimite()
    {
        await using var db = Contexto();
        var servico = Servico(db, limite: 1);

        await servico.ReservarPerguntaAsync(1, CancellationToken.None);
        await Assert.ThrowsAsync<LimiteIaExcedidoException>(() => servico.ReservarPerguntaAsync(1, CancellationToken.None));

        Assert.Equal(0, await servico.ReservarPerguntaAsync(2, CancellationToken.None));
    }

    [Fact]
    public async Task Reservar_NoDiaSeguinteDeBrasiliaOLimiteRecomeca()
    {
        await using var db = Contexto();
        var servico = Servico(db, limite: 1);

        // 13/11 às 23h50 em Brasília (02h50 UTC do dia 14).
        _relogio.Agora = new DateTimeOffset(2026, 11, 14, 2, 50, 0, TimeSpan.Zero);
        await servico.ReservarPerguntaAsync(1, CancellationToken.None);
        await Assert.ThrowsAsync<LimiteIaExcedidoException>(() => servico.ReservarPerguntaAsync(1, CancellationToken.None));

        // 14/11 às 00h10 em Brasília.
        _relogio.Agora = new DateTimeOffset(2026, 11, 14, 3, 10, 0, TimeSpan.Zero);
        Assert.Equal(0, await servico.ReservarPerguntaAsync(1, CancellationToken.None));

        var dias = await db.UsosIa.Where(u => u.EmpresaId == 1).OrderBy(u => u.Dia).Select(u => u.Dia).ToListAsync();
        Assert.Equal([new DateOnly(2026, 11, 13), new DateOnly(2026, 11, 14)], dias);
    }

    [Fact]
    public async Task Devolver_LiberaAPerguntaQueFalhou()
    {
        await using var db = Contexto();
        var servico = Servico(db, limite: 1);

        await servico.ReservarPerguntaAsync(1, CancellationToken.None);
        await servico.DevolverPerguntaAsync(1, CancellationToken.None);

        Assert.Equal(0, await servico.ReservarPerguntaAsync(1, CancellationToken.None));
    }

    [Fact]
    public async Task RegistrarTokensERelatorios_SomamNaLinhaDoDia()
    {
        await using var db = Contexto();
        var servico = Servico(db);

        await servico.ReservarPerguntaAsync(1, CancellationToken.None);
        await servico.RegistrarTokensDaPerguntaAsync(1, 900, 40, CancellationToken.None);
        await servico.RegistrarRelatorioAsync(1, 2000, 300, CancellationToken.None);
        await servico.RegistrarRelatorioAsync(1, 1000, 100, CancellationToken.None);

        var linha = await db.UsosIa.AsNoTracking().SingleAsync(u => u.EmpresaId == 1);
        Assert.Equal((1, 2, 3900L, 440L), (linha.Perguntas, linha.Relatorios, linha.TokensEntrada, linha.TokensSaida));
    }

    private sealed class RelogioFixo(DateTimeOffset agora) : TimeProvider
    {
        public DateTimeOffset Agora { get; set; } = agora;
        public override DateTimeOffset GetUtcNow() => Agora;
    }
}
