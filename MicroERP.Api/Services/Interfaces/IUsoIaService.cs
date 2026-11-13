using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

// Limite diário e registro de consumo da IA por empresa (DEC-21).
public interface IUsoIaService
{
    int PerguntasPorDia { get; }

    /// <summary>
    /// Reserva uma pergunta de hoje antes de chamar o modelo. Devolve quantas
    /// ainda restam; lança LimiteIaExcedidoException se o limite já foi atingido.
    /// </summary>
    Task<int> ReservarPerguntaAsync(long empresaId, CancellationToken cancellationToken);

    /// <summary>Devolve a pergunta reservada quando o modelo falhou (a empresa não paga pela falha).</summary>
    Task DevolverPerguntaAsync(long empresaId, CancellationToken cancellationToken);

    /// <summary>Soma os tokens de uma pergunta já reservada.</summary>
    Task RegistrarTokensDaPerguntaAsync(long empresaId, long tokensEntrada, long tokensSaida, CancellationToken cancellationToken);

    /// <summary>Conta um relatório de insights e os tokens dele (relatórios não têm limite diário).</summary>
    Task RegistrarRelatorioAsync(long empresaId, long tokensEntrada, long tokensSaida, CancellationToken cancellationToken);

    Task<UsoIaResponse> ObterHojeAsync(long empresaId, CancellationToken cancellationToken);
}
