using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IInsightsService
{
    Task<InsightsResponse> GerarAsync(long empresaId, DateTime? de, DateTime? ate, CancellationToken cancellationToken);
}
