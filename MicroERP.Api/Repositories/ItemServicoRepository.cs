using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ItemServicoRepository : IItemServicoRepository
{
    private readonly AppDbContext _dbContext;

    public ItemServicoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<ItemServico>> GetAllByAtendimentoAsync(long empresaId, long atendimentoId, CancellationToken cancellationToken)
    {
        // PAG-01: o serviço vem junto (mesmo excluído) para nomear o item, sem N+1.
        return await _dbContext.ItemServicos
            .AsNoTracking()
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null && i.Atendimento!.EmpresaId == empresaId)
            .Include(i => i.Servico)
            .OrderBy(i => i.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<ItemServico?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        IQueryable<ItemServico> query = _dbContext.ItemServicos
            .Where(i => i.Id == id && i.DeletedAt == null && i.Atendimento!.EmpresaId == empresaId)
            .Include(i => i.Servico);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<List<ItemServico>> GetAllByAtendimentoTrackedAsync(long atendimentoId, CancellationToken cancellationToken)
    {
        return await _dbContext.ItemServicos
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null)
            .ToListAsync(cancellationToken);
    }

    public async Task<decimal> SumSubtotalByAtendimentoAsync(long atendimentoId, CancellationToken cancellationToken)
    {
        // Soma client-side: portavel entre provedores (SQLite nao suporta SUM sobre decimal).
        var subtotais = await _dbContext.ItemServicos
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null)
            .Select(i => i.Subtotal)
            .ToListAsync(cancellationToken);
        return subtotais.Sum();
    }

    public async Task AddAsync(ItemServico itemServico, CancellationToken cancellationToken)
    {
        await _dbContext.ItemServicos.AddAsync(itemServico, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}