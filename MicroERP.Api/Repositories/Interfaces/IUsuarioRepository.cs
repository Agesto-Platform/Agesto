using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IUsuarioRepository
{
    Task<Usuario?> GetByIdAsync(long id, CancellationToken cancellationToken);
    Task<Usuario?> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<IReadOnlyList<Usuario>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken);
    Task<int> CountDonosAtivos(long empresaId, CancellationToken cancellationToken);
    Task AddAsync(Usuario usuario, CancellationToken cancellationToken);
    Task<int> CountDonos(long empresaId, CancellationToken cancellationToken);
    Task DeleteAsync(Usuario usuario, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}