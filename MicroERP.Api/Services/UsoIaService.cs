using System.Data;
using System.Data.Common;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;

namespace MicroERP.Api.Services;

// Limite diário de perguntas ao Agente e consumo da IA por empresa (DEC-21).
// O dia é o de Brasília. A reserva é um único INSERT ... ON CONFLICT com a
// condição no próprio UPDATE, então duas perguntas ao mesmo tempo não passam
// do limite (funciona no PostgreSQL e no SQLite dos testes).
public sealed class UsoIaService : IUsoIaService
{
    private static readonly TimeZoneInfo Brasilia = ResolverFusoDeBrasilia();

    private const string SqlReservar = """
        INSERT INTO "UsosIa" ("EmpresaId", "Dia", "Perguntas", "Relatorios", "TokensEntrada", "TokensSaida", "CreatedAt", "UpdatedAt")
        VALUES (@empresaId, @dia, 1, 0, 0, 0, @agora, @agora)
        ON CONFLICT ("EmpresaId", "Dia") DO UPDATE
            SET "Perguntas" = "UsosIa"."Perguntas" + 1, "UpdatedAt" = @agora
            WHERE "UsosIa"."Perguntas" < @limite
        RETURNING "Perguntas"
        """;

    private const string SqlRelatorio = """
        INSERT INTO "UsosIa" ("EmpresaId", "Dia", "Perguntas", "Relatorios", "TokensEntrada", "TokensSaida", "CreatedAt", "UpdatedAt")
        VALUES (@empresaId, @dia, 0, 1, @tokensEntrada, @tokensSaida, @agora, @agora)
        ON CONFLICT ("EmpresaId", "Dia") DO UPDATE
            SET "Relatorios" = "UsosIa"."Relatorios" + 1,
                "TokensEntrada" = "UsosIa"."TokensEntrada" + @tokensEntrada,
                "TokensSaida" = "UsosIa"."TokensSaida" + @tokensSaida,
                "UpdatedAt" = @agora
        """;

    private readonly AppDbContext _db;
    private readonly TimeProvider _relogio;

    public UsoIaService(AppDbContext db, IOptions<InsightsOptions> options, TimeProvider relogio)
    {
        _db = db;
        _relogio = relogio;
        PerguntasPorDia = Math.Max(1, options.Value.PerguntasPorDia);
    }

    public int PerguntasPorDia { get; }

    public async Task<int> ReservarPerguntaAsync(long empresaId, CancellationToken cancellationToken)
    {
        var (agora, dia) = Agora();
        var usadas = await ExecutarAsync(SqlReservar, cancellationToken,
            ("empresaId", empresaId), ("dia", dia), ("agora", agora), ("limite", PerguntasPorDia));
        if (usadas is null) throw new LimiteIaExcedidoException(PerguntasPorDia);
        return Math.Max(0, PerguntasPorDia - usadas.Value);
    }

    public async Task DevolverPerguntaAsync(long empresaId, CancellationToken cancellationToken)
    {
        var (agora, dia) = Agora();
        await _db.UsosIa
            .Where(u => u.EmpresaId == empresaId && u.Dia == dia && u.Perguntas > 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.Perguntas, u => u.Perguntas - 1)
                .SetProperty(u => u.UpdatedAt, agora), cancellationToken);
    }

    public async Task RegistrarTokensDaPerguntaAsync(long empresaId, long tokensEntrada, long tokensSaida, CancellationToken cancellationToken)
    {
        var (agora, dia) = Agora();
        await _db.UsosIa
            .Where(u => u.EmpresaId == empresaId && u.Dia == dia)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.TokensEntrada, u => u.TokensEntrada + tokensEntrada)
                .SetProperty(u => u.TokensSaida, u => u.TokensSaida + tokensSaida)
                .SetProperty(u => u.UpdatedAt, agora), cancellationToken);
    }

    public async Task RegistrarRelatorioAsync(long empresaId, long tokensEntrada, long tokensSaida, CancellationToken cancellationToken)
    {
        var (agora, dia) = Agora();
        await ExecutarAsync(SqlRelatorio, cancellationToken,
            ("empresaId", empresaId), ("dia", dia), ("agora", agora),
            ("tokensEntrada", tokensEntrada), ("tokensSaida", tokensSaida));
    }

    public async Task<UsoIaResponse> ObterHojeAsync(long empresaId, CancellationToken cancellationToken)
    {
        var (_, dia) = Agora();
        var usadas = await _db.UsosIa.AsNoTracking()
            .Where(u => u.EmpresaId == empresaId && u.Dia == dia)
            .Select(u => u.Perguntas)
            .FirstOrDefaultAsync(cancellationToken);
        return new UsoIaResponse
        {
            Limite = PerguntasPorDia,
            Usadas = usadas,
            Restantes = Math.Max(0, PerguntasPorDia - usadas),
        };
    }

    private (DateTime Agora, DateOnly Dia) Agora()
    {
        var agora = _relogio.GetUtcNow().UtcDateTime;
        return (agora, DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(agora, Brasilia)));
    }

    // Comando direto: o EF não compõe INSERT ... RETURNING. Usa a conexão e a
    // transação do contexto, então respeita quem já estiver numa transação.
    private async Task<int?> ExecutarAsync(string sql, CancellationToken cancellationToken, params (string Nome, object Valor)[] parametros)
    {
        var conexao = _db.Database.GetDbConnection();
        var abriu = conexao.State != ConnectionState.Open;
        if (abriu) await _db.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await using DbCommand comando = conexao.CreateCommand();
            comando.CommandText = sql;
            comando.Transaction = _db.Database.CurrentTransaction?.GetDbTransaction();
            foreach (var (nome, valor) in parametros)
            {
                var p = comando.CreateParameter();
                p.ParameterName = nome;
                p.Value = valor;
                comando.Parameters.Add(p);
            }
            var resultado = await comando.ExecuteScalarAsync(cancellationToken);
            return resultado is null or DBNull ? null : Convert.ToInt32(resultado);
        }
        finally
        {
            if (abriu) await _db.Database.CloseConnectionAsync();
        }
    }

    private static TimeZoneInfo ResolverFusoDeBrasilia()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var fuso)) return fuso;
        }
        return TimeZoneInfo.CreateCustomTimeZone("Brasilia", TimeSpan.FromHours(-3), "Brasília", "Brasília");
    }
}
