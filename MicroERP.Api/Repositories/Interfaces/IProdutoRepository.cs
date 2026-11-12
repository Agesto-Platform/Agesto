using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IProdutoRepository
{
    Task<(List<Produto> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, IReadOnlyCollection<long>? ids, CancellationToken cancellationToken);
    Task<Produto?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task AddAsync(Produto produto, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
