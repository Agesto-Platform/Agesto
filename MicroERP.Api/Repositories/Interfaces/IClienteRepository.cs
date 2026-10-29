using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IClienteRepository
{
    Task<List<Cliente>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<(List<Cliente> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken);
    Task<Cliente?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task<Cliente?> GetByCpfAsync(long empresaId, string cpf, CancellationToken cancellationToken);
    Task AddAsync(Cliente cliente, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}