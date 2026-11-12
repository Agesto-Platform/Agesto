using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ItemProdutoRepository : IItemProdutoRepository
{
    private readonly AppDbContext _dbContext;

    public ItemProdutoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<ItemProduto>> GetAllByAtendimentoAsync(long empresaId, long atendimentoId, CancellationToken cancellationToken)
    {
        // PAG-01: o produto vem junto (mesmo excluído) para nomear o item, sem N+1.
        return await _dbContext.ItemProdutos
            .AsNoTracking()
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null && i.Atendimento!.EmpresaId == empresaId)
            .Include(i => i.Produto)
            .OrderBy(i => i.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<ItemProduto?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        IQueryable<ItemProduto> query = _dbContext.ItemProdutos
            .Where(i => i.Id == id && i.DeletedAt == null && i.Atendimento!.EmpresaId == empresaId)
            .Include(i => i.Produto);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<List<ItemProduto>> GetAllByAtendimentoTrackedAsync(long atendimentoId, CancellationToken cancellationToken)
    {
        return await _dbContext.ItemProdutos
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null)
            .ToListAsync(cancellationToken);
    }

    public async Task<decimal> SumSubtotalByAtendimentoAsync(long atendimentoId, CancellationToken cancellationToken)
    {
        // Soma client-side: poucos itens por atendimento e portavel entre provedores
        // (SQLite nao suporta agregado SUM sobre decimal no servidor).
        var subtotais = await _dbContext.ItemProdutos
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null)
            .Select(i => i.Subtotal)
            .ToListAsync(cancellationToken);
        return subtotais.Sum();
    }

    public async Task<decimal> SumCustoByAtendimentoAsync(long atendimentoId, CancellationToken cancellationToken)
    {
        var custos = await _dbContext.ItemProdutos
            .Where(i => i.AtendimentoId == atendimentoId && i.DeletedAt == null)
            .Select(i => i.Custo ?? 0m)
            .ToListAsync(cancellationToken);
        return custos.Sum();
    }

    public async Task AddAsync(ItemProduto itemProduto, CancellationToken cancellationToken)
    {
        await _dbContext.ItemProdutos.AddAsync(itemProduto, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}