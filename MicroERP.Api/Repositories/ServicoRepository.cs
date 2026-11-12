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

    public Task<(List<Servico> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, bool? revisado, CancellationToken cancellationToken)
    {
        var query = _dbContext.Servicos
            .AsNoTracking()
            .Where(s => s.EmpresaId == empresaId && s.DeletedAt == null);
        // PAG-01: revisado=false traz só os criados pelo agente que o Dono ainda não revisou.
        if (revisado.HasValue) query = query.Where(s => s.Revisado == revisado.Value);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = FuncoesSql.NormalizarTermo(busca);
            query = query.Where(s =>
                FuncoesSql.Translate(s.Descricao.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo));
        }
        return query
            .Include(s => s.CriadoPor)
            .OrderBy(s => s.Descricao)
            .ThenBy(s => s.Id)
            .ToPaginaAsync(pagina, tamanho, cancellationToken);
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
