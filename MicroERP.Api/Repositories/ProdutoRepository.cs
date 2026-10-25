using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ProdutoRepository : IProdutoRepository
{
    private readonly AppDbContext _dbContext;

    public ProdutoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Produto>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await Listagem(empresaId).ToListAsync(cancellationToken);
    }

    public Task<(List<Produto> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken)
    {
        return Listagem(empresaId).ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    private IQueryable<Produto> Listagem(long empresaId)
    {
        return _dbContext.Produtos
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId && p.DeletedAt == null)
            .OrderBy(p => p.Nome)
            .ThenBy(p => p.Id);
    }

    public async Task<Produto?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Produtos
            .Where(p => p.EmpresaId == empresaId && p.Id == id && p.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(Produto produto, CancellationToken cancellationToken)
    {
        await _dbContext.Produtos.AddAsync(produto, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
