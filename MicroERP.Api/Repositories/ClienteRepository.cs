using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class ClienteRepository : IClienteRepository
{
    private readonly AppDbContext _dbContext;

    public ClienteRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<(List<Cliente> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, string? busca, CancellationToken cancellationToken)
    {
        var query = Listagem(empresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            // PAG-01: a mesma busca que o web fazia na memória, agora no banco.
            var termo = FuncoesSql.NormalizarTermo(busca);
            var digitos = FuncoesSql.SoDigitos(busca);
            query = query.Where(c =>
                FuncoesSql.Translate(c.Nome.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)
                || FuncoesSql.Translate((c.Logradouro ?? "").ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)
                || FuncoesSql.Translate((c.Bairro ?? "").ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)
                || FuncoesSql.Translate((c.Cidade ?? "").ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo)
                || (digitos.Length >= 3
                    && FuncoesSql.Translate(c.Telefone ?? "", FuncoesSql.PontuacaoTelefone, "").Contains(digitos)));
        }
        return query.ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    // PAG-01: quantos atendimentos vivos cada cliente tem e a data do mais recente,
    // para as colunas da lista (o web deixava de baixar todos os atendimentos).
    public async Task<Dictionary<long, (int Total, DateTime? Ultimo)>> GetEstatisticasAsync(
        long empresaId, IReadOnlyCollection<long> clienteIds, CancellationToken cancellationToken)
    {
        if (clienteIds.Count == 0) return [];

        var linhas = await _dbContext.Atendimentos
            .AsNoTracking()
            .Where(a => a.EmpresaId == empresaId && a.DeletedAt == null && clienteIds.Contains(a.ClienteId))
            .GroupBy(a => a.ClienteId)
            .Select(g => new { ClienteId = g.Key, Total = g.Count(), Ultimo = g.Max(a => a.DataAgendada ?? a.DataRegistro) })
            .ToListAsync(cancellationToken);

        return linhas.ToDictionary(l => l.ClienteId, l => (l.Total, (DateTime?)l.Ultimo));
    }

    private IQueryable<Cliente> Listagem(long empresaId)
    {
        return _dbContext.Clientes
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId && c.DeletedAt == null)
            .OrderBy(c => c.Nome)
            .ThenBy(c => c.Id);
    }

    public async Task<Cliente?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        var query = _dbContext.Clientes
            .Where(c => c.EmpresaId == empresaId && c.Id == id && c.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Cliente?> GetByCpfAsync(long empresaId, string cpf, CancellationToken cancellationToken)
    {
        return await _dbContext.Clientes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId && c.Cpf == cpf && c.DeletedAt == null, cancellationToken);
    }

    public async Task AddAsync(Cliente cliente, CancellationToken cancellationToken)
    {
        await _dbContext.Clientes.AddAsync(cliente, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
