using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoSyncRequest
{
    // Produto do catalogo (baixa estoque). Nulo = item avulso: exige Descricao e
    // PrecoUnitario e nao movimenta estoque, como no web.
    public long? ProdutoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Usado so no item avulso; o de catalogo cobra o preco do produto.
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }

    public int Quantidade { get; set; }
}
