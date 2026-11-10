using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IAgenteService
{
    Task<AgenteRespostaResponse> PerguntarAsync(long empresaId, AgentePerguntaRequest request, CancellationToken cancellationToken);
}
