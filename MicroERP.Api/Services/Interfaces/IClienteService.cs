using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IClienteService
{
    Task<IReadOnlyList<ClienteResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<PaginaResponse<ClienteResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, CancellationToken cancellationToken);
    Task<ClienteResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<ClienteResponse> CreateAsync(long empresaId, ClienteCreateRequest request, CancellationToken cancellationToken);
    Task<ClienteResponse> UpdateAsync(long empresaId, long id, ClienteUpdateRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
}
