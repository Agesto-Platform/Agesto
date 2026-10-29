using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IOrcamentoService
{
    Task<IReadOnlyList<OrcamentoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<PaginaResponse<OrcamentoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, CancellationToken cancellationToken);
    Task<OrcamentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<OrcamentoResponse> CreateAsync(long empresaId, long usuarioId, OrcamentoCreateRequest request, CancellationToken cancellationToken);
    Task<OrcamentoResponse> UpdateStatusAsync(long empresaId, long id, OrcamentoUpdateRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<AtendimentoResponse> ConverterAsync(long empresaId, long usuarioId, long id, CancellationToken cancellationToken);
}
