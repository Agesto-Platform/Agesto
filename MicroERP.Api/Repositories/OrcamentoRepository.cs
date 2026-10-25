using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class OrcamentoRepository : IOrcamentoRepository
{
    private readonly AppDbContext _dbContext;

    public OrcamentoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Orcamento>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await Listagem(empresaId).ToListAsync(cancellationToken);
    }

    public Task<(List<Orcamento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken)
    {
        return Listagem(empresaId).ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    private IQueryable<Orcamento> Listagem(long empresaId)
    {
        return _dbContext.Orcamentos
            .AsNoTracking()
            .Where(o => o.EmpresaId == empresaId && o.DeletedAt == null)
            .Include(o => o.Itens.Where(i => i.DeletedAt == null))
            .OrderByDescending(o => o.DataRegistro)
            .ThenBy(o => o.Id);
    }

    public async Task<Orcamento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        IQueryable<Orcamento> query = _dbContext.Orcamentos
            .Where(o => o.EmpresaId == empresaId && o.Id == id && o.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query
            .Include(o => o.Itens.Where(i => i.DeletedAt == null))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(Orcamento orcamento, CancellationToken cancellationToken)
    {
        await _dbContext.Orcamentos.AddAsync(orcamento, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
