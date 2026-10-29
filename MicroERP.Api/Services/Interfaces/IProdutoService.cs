using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IProdutoService
{
    Task<IReadOnlyList<ProdutoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<PaginaResponse<ProdutoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, CancellationToken cancellationToken);
    Task<ProdutoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<ProdutoResponse> CreateAsync(long empresaId, ProdutoCreateRequest request, CancellationToken cancellationToken);
    Task<ProdutoResponse> UpdateAsync(long empresaId, long id, ProdutoUpdateRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
}
