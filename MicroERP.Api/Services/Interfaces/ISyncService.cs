using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface ISyncService
{
    // agenteId: de quem vêm a agenda e o histórico (Agente: só os dele; Dono: null = todos).
    Task<SyncCargaResponse> CargaAsync(long empresaId, DateTime? ultimaSincronizacao, CancellationToken cancellationToken, bool restringirDadosSensiveis = false, long? agenteId = null);
    Task<SyncDescargaResponse> DescargaAsync(long empresaId, long usuarioId, SyncDescargaRequest request, CancellationToken cancellationToken, bool porDono = false);
}