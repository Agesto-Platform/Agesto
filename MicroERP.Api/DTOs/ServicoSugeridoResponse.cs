namespace MicroERP.Api.DTOs;

public sealed class ServicoSugeridoResponse
{
    public long ProdutoId { get; set; }
    public string ProdutoNome { get; set; } = string.Empty;
    // PAG-01: preço atual do produto, para lançar o kit sem baixar o catálogo.
    public decimal ProdutoPreco { get; set; }
    public int QuantidadePadrao { get; set; }
}
