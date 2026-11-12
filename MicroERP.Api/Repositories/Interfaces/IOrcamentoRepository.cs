using MicroERP.Api.Enums;
using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IOrcamentoRepository
{
    Task<(List<Orcamento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, StatusOrcamento? status, CancellationToken cancellationToken);
    Task<Dictionary<StatusOrcamento, (int Quantidade, decimal ValorTotal)>> ResumirPorStatusAsync(long empresaId, CancellationToken cancellationToken);
    Task<RotulosItensOrcamento> GetRotulosDosItensAsync(long empresaId, IEnumerable<ItemOrcamento> itens, CancellationToken cancellationToken);
    Task<Orcamento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task<bool> ReservarParaConversaoAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task AddAsync(Orcamento orcamento, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

// PAG-01: nome do produto e descrição/cobrança do serviço de cada item do orçamento.
// Os itens guardam só o id (sem FK nem navegação), então os rótulos vêm em lote.
public sealed record RotulosItensOrcamento(
    IReadOnlyDictionary<long, string> Produtos,
    IReadOnlyDictionary<long, (string Descricao, TipoCobranca TipoCobranca)> Servicos)
{
    public static readonly RotulosItensOrcamento Vazio = new(
        new Dictionary<long, string>(),
        new Dictionary<long, (string Descricao, TipoCobranca TipoCobranca)>());
}
