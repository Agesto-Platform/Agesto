using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ConfiguracaoRepository : IConfiguracaoRepository
{
    private readonly AppDbContext _dbContext;

    public ConfiguracaoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Configuracao?> GetByEmpresaAsync(long empresaId, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Configuracoes
            .Include(c => c.Empresa)
            .Where(c => c.EmpresaId == empresaId);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}