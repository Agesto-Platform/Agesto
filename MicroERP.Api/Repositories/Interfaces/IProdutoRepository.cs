using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IProdutoRepository
{
    Task<List<Produto>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<(List<Produto> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken);
    Task<Produto?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task AddAsync(Produto produto, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
