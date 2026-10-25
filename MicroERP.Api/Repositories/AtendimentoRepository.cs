using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class AtendimentoRepository : IAtendimentoRepository
{
    private readonly AppDbContext _dbContext;

    public AtendimentoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Atendimento>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await Listagem(empresaId).ToListAsync(cancellationToken);
    }

    public Task<(List<Atendimento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken)
    {
        return Listagem(empresaId).ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    private IQueryable<Atendimento> Listagem(long empresaId)
    {
        return _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.DeletedAt == null)
            .OrderByDescending(a => a.DataRegistro)
            .ThenBy(a => a.Id);
    }

    public async Task<List<Atendimento>> GetAgendaAsync(long empresaId, DateTime de, DateTime ate, long? usuarioId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId
                        && a.DeletedAt == null
                        && a.DataAgendada != null
                        && a.DataAgendada >= de
                        && a.DataAgendada <= ate);

        if (usuarioId.HasValue)
        {
            query = query.Where(a => a.UsuarioId == usuarioId.Value);
        }

        // Enriquecimento p/ agenda mobile (evita N+1): cliente + itens com seus
        // catalogos. Itens soft-deletados sao filtrados no mapeamento (service).
        return await query
            .Include(a => a.Cliente)
            .Include(a => a.ItensServico).ThenInclude(i => i.Servico)
            .Include(a => a.ItensProduto).ThenInclude(i => i.Produto)
            .OrderBy(a => a.DataAgendada)
            .ToListAsync(cancellationToken);
    }

    public async Task<Atendimento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Atendimentos
            .Where(a => a.EmpresaId == empresaId && a.Id == id && a.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(Atendimento atendimento, CancellationToken cancellationToken)
    {
        await _dbContext.Atendimentos.AddAsync(atendimento, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}