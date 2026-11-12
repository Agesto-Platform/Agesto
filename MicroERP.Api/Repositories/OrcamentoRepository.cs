using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class OrcamentoRepository : IOrcamentoRepository
{
    private readonly AppDbContext _dbContext;

    public OrcamentoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // PAG-01: a lista do web, paginada, com o cliente junto. Mais recentes primeiro.
    public Task<(List<Orcamento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, StatusOrcamento? status, CancellationToken cancellationToken)
    {
        var query = _dbContext.Orcamentos
            .AsNoTracking()
            .Where(o => o.EmpresaId == empresaId && o.DeletedAt == null);

        if (status.HasValue) query = query.Where(o => o.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            // Busca pelo nome do cliente, sem acento e sem diferença de maiúsculas.
            var termo = FuncoesSql.NormalizarTermo(busca);
            query = query.Where(o =>
                FuncoesSql.Translate(o.Cliente!.Nome.ToLower(), FuncoesSql.ComAcento, FuncoesSql.SemAcento).Contains(termo));
        }

        return query
            .OrderByDescending(o => o.DataRegistro)
            .ThenByDescending(o => o.Id)
            .Include(o => o.Cliente)
            .Include(o => o.Itens.Where(i => i.DeletedAt == null))
            .ToPaginaAsync(pagina, tamanho, cancellationToken);
    }

    // PAG-01: card de funil da tela de Orçamentos (quantos e quanto por status).
    public async Task<Dictionary<StatusOrcamento, (int Quantidade, decimal ValorTotal)>> ResumirPorStatusAsync(
        long empresaId, CancellationToken cancellationToken)
    {
        var linhas = await _dbContext.Orcamentos
            .AsNoTracking()
            .Where(o => o.EmpresaId == empresaId && o.DeletedAt == null)
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Quantidade = g.Count(), ValorTotal = g.Sum(o => o.ValorTotal) })
            .ToListAsync(cancellationToken);
        return linhas.ToDictionary(l => l.Status, l => (l.Quantidade, l.ValorTotal));
    }

    public Task<RotulosItensOrcamento> GetRotulosDosItensAsync(long empresaId, IEnumerable<ItemOrcamento> itens, CancellationToken cancellationToken) =>
        CarregarRotulosAsync(_dbContext, empresaId, itens, cancellationToken);

    // Também usado pela Carga do sync, que monta os orçamentos direto do contexto.
    // Duas consultas por lote (não por item); inclui produto/serviço já excluído
    // para o item antigo continuar nomeado. Sempre da própria empresa.
    internal static async Task<RotulosItensOrcamento> CarregarRotulosAsync(
        AppDbContext dbContext, long empresaId, IEnumerable<ItemOrcamento> itens, CancellationToken cancellationToken)
    {
        var lista = itens.ToList();
        var produtoIds = lista.Where(i => i.ProdutoId.HasValue).Select(i => i.ProdutoId!.Value).Distinct().ToList();
        var servicoIds = lista.Where(i => i.ServicoId.HasValue).Select(i => i.ServicoId!.Value).Distinct().ToList();

        var produtos = produtoIds.Count == 0
            ? new Dictionary<long, string>()
            : await dbContext.Produtos
                .AsNoTracking()
                .Where(p => p.EmpresaId == empresaId && produtoIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Nome, cancellationToken);

        var servicos = servicoIds.Count == 0
            ? new Dictionary<long, (string Descricao, TipoCobranca TipoCobranca)>()
            : (await dbContext.Servicos
                .AsNoTracking()
                .Where(s => s.EmpresaId == empresaId && servicoIds.Contains(s.Id))
                .Select(s => new { s.Id, s.Descricao, s.TipoCobranca })
                .ToListAsync(cancellationToken))
                .ToDictionary(s => s.Id, s => (s.Descricao, s.TipoCobranca));

        return new RotulosItensOrcamento(produtos, servicos);
    }

    public async Task<Orcamento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken)
    {
        IQueryable<Orcamento> query = _dbContext.Orcamentos
            .Where(o => o.EmpresaId == empresaId && o.Id == id && o.DeletedAt == null);

        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query
            .Include(o => o.Cliente)
            .Include(o => o.Itens.Where(i => i.DeletedAt == null))
            .FirstOrDefaultAsync(cancellationToken);
    }

    // UPDATE condicional que trava a linha até o fim da transação: numa conversão
    // concorrente, a segunda espera o commit da primeira e então não acha mais o
    // orçamento livre (0 linhas). Precisa rodar dentro de uma transação.
    public async Task<bool> ReservarParaConversaoAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var linhas = await _dbContext.Orcamentos
            .Where(o => o.EmpresaId == empresaId && o.Id == id && o.DeletedAt == null && o.AtendimentoConvertidoId == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.UpdatedAt, DateTime.UtcNow), cancellationToken);
        return linhas == 1;
    }

    public async Task AddAsync(Orcamento orcamento, CancellationToken cancellationToken)
    {
        await _dbContext.Orcamentos.AddAsync(orcamento, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
