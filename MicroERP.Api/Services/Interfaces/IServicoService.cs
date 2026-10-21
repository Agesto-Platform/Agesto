using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IServicoService
{
    Task<IReadOnlyList<ServicoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<ServicoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<ServicoResponse> CreateAsync(long empresaId, ServicoCreateRequest request, CancellationToken cancellationToken);
    Task<ServicoResponse> UpdateAsync(long empresaId, long id, ServicoUpdateRequest request, CancellationToken cancellationToken);
    // Dono confirma um serviço criado pelo agente sem precisar editar.
    Task<ServicoResponse> MarcarRevisadoAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
}
