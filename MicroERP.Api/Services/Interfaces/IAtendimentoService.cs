using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IAtendimentoService
{
    Task<IReadOnlyList<AtendimentoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<PaginaResponse<AtendimentoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, CancellationToken cancellationToken);
    Task<IReadOnlyList<AgendaItemResponse>> GetAgendaAsync(long empresaId, DateTime? de, DateTime? ate, long? agenteId, CancellationToken cancellationToken);
    Task<AtendimentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<AtendimentoResponse> CreateAsync(long empresaId, long usuarioId, AtendimentoCreateRequest request, CancellationToken cancellationToken);
    Task<AtendimentoResponse> UpdateAsync(long empresaId, long id, AtendimentoUpdateRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
}
