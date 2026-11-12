namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public decimal? Custo { get; set; }
    public string? Descricao { get; set; }
    public long AtendimentoId { get; set; }
    public long? ProdutoId { get; set; }
    // PAG-01: nome do produto do catálogo (nulo no item avulso), mesmo já excluído.
    public string? ProdutoNome { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
