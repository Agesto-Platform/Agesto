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

    public Task<(List<Produto> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, IReadOnlyCollection<long>? ids, CancellationToken cancellationToken)
    {
        var query = _dbContext.Produtos
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId && p.DeletedAt == null);
        // Só os produtos pedidos (alertas de estoque); o filtro da empresa continua valendo.
        if (ids is not null) query = query.Where(p => ids.Contains(p.Id));
        if (!string.IsNullOrWhiteSpace(busca))
        {
            // PAG-01: busca pelo nome, sem acento e sem diferença de maiúsculas.
            var termo = FuncoesSql.NormalizarTermo(busca);
            query = query.Where(p =>
                FuncoesSql.Translate(p.Nome.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo));
        }
        return query
            .OrderBy(p => p.Nome)
            .ThenBy(p => p.Id)
            .ToPaginaAsync(pagina, tamanho, cancellationToken);
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
