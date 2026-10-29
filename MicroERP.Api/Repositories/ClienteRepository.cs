using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ClienteRepository : IClienteRepository
{
    private readonly AppDbContext _dbContext;

    public ClienteRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Cliente>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await Listagem(empresaId).ToListAsync(cancellationToken);
    }

    public Task<(List<Cliente> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken)
    {
        return Listagem(empresaId).ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    private IQueryable<Cliente> Listagem(long empresaId)
    {
        return _dbContext.Clientes
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId && c.DeletedAt == null)
            .OrderBy(c => c.Nome)
            .ThenBy(c => c.Id);
    }

    public async Task<Cliente?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Clientes
            .Where(c => c.EmpresaId == empresaId && c.Id == id && c.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Cliente?> GetByCpfAsync(long empresaId, string cpf, CancellationToken cancellationToken)
    {
        return await _dbContext.Clientes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId && c.Cpf == cpf && c.DeletedAt == null, cancellationToken);
    }

    public async Task AddAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        await _dbContext.Clientes.AddAsync(cliente, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
