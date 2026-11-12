using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
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

    // PAG-01: a lista do web, paginada, com os filtros da tela e o cliente junto. Ordem
    // da tela: a data agendada, senão a de registro, da mais recente para a mais antiga.
    public Task<(List<Atendimento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, StatusAtendimento? status, long? clienteId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.DeletedAt == null);

        if (status.HasValue) query = query.Where(a => a.Status == status.Value);
        if (clienteId.HasValue) query = query.Where(a => a.ClienteId == clienteId.Value);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = FuncoesSql.NormalizarTermo(busca);
            query = query.Where(a =>
                FuncoesSql.Translate(a.Cliente!.Nome.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)
                || a.ItensServico.Any(i => i.DeletedAt == null
                    && FuncoesSql.Translate(i.Servico!.Descricao.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo))
                || a.ItensProduto.Any(i => i.DeletedAt == null
                    && FuncoesSql.Translate((i.Descricao ?? i.Produto!.Nome).ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)));
        }

        return query
            .Include(a => a.Cliente)
            .OrderByDescending(a => a.DataAgendada ?? a.DataRegistro)
            .ThenByDescending(a => a.Id)
            .ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    // PAG-01: os números das abas da tela de Atendimentos.
    public async Task<Dictionary<StatusAtendimento, int>> ContarPorStatusAsync(long empresaId, CancellationToken cancellationToken)
    {
        var linhas = await _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.DeletedAt == null)
            .GroupBy(a => a.Status)
            .Select(g => new { Status = g.Key, Total = g.Count() })
            .ToListAsync(cancellationToken);
        return linhas.ToDictionary(l => l.Status, l => l.Total);
    }

    // PAG-02: resumo da linha (primeiro serviço vivo, senão o primeiro produto) em uma
    // consulta só, com subconsultas escalares; as listas do web não precisam mais pedir
    // a agenda do ano inteiro só por ele.
    public async Task<Dictionary<long, string?>> GetResumosAsync(long empresaId, IReadOnlyCollection<long> ids, CancellationToken cancellationToken)
    {
        if (ids.Count == 0) return [];

        var linhas = await _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && ids.Contains(a.Id))
            .Select(a => new
            {
                a.Id,
                Servico = a.ItensServico
                    .Where(i => i.DeletedAt == null)
                    .OrderBy(i => i.Id)
                    .Select(i => i.Servico!.Descricao)
                    .FirstOrDefault(),
                Produto = a.ItensProduto
                    .Where(i => i.DeletedAt == null)
                    .OrderBy(i => i.Id)
                    .Select(i => i.Descricao ?? i.Produto!.Nome)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return linhas.ToDictionary(
            l => l.Id,
            l => !string.IsNullOrWhiteSpace(l.Servico) ? l.Servico
               : !string.IsNullOrWhiteSpace(l.Produto) ? l.Produto
               : null);
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