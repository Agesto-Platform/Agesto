using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IOrcamentoRepository
{
    Task<List<Orcamento>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<(List<Orcamento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken);
    Task<Orcamento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task AddAsync(Orcamento orcamento, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
