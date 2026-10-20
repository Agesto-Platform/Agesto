using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ServicoRepository : IServicoRepository
{
    private readonly AppDbContext _dbContext;

    public ServicoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Servico>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await _dbContext.Servicos
            .AsNoTracking()
            .Include(s => s.CriadoPor)
            .Where(s => s.EmpresaId == empresaId && s.DeletedAt == null)
            .OrderBy(s => s.Descricao)
            .ToListAsync(cancellationToken);
    }

    public async Task<Servico?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Servicos
            .Include(s => s.CriadoPor)
            .Where(s => s.EmpresaId == empresaId && s.Id == id && s.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Servico?> GetByDescricaoAsync(long empresaId, string descricao, CancellationToken cancellationToken)
    {
        var alvo = descricao.Trim().ToLower();
        return await _dbContext.Servicos
            .AsNoTracking()
            .Where(s => s.EmpresaId == empresaId && s.DeletedAt == null && s.Descricao.ToLower() == alvo)
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(Servico servico, CancellationToken cancellationToken)
    {
        await _dbContext.Servicos.AddAsync(servico, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
