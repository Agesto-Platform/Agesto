using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface ISyncService
{
    Task<SyncCargaResponse> CargaAsync(long empresaId, DateTime? ultimaSincronizacao, CancellationToken cancellationToken, bool restringirDadosSensiveis = false);
    Task<SyncDescargaResponse> DescargaAsync(long empresaId, long usuarioId, SyncDescargaRequest request, CancellationToken cancellationToken);
}