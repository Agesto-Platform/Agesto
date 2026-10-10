using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoUpdateRequest
{
    [Range(1, 9999, ErrorMessage = "Quantidade invalida.")]
    public int Quantidade { get; set; }

    // Opcional: corrige a descricao (util para itens avulsos). Se nulo, mantem a atual.
    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Opcional: sobrescreve o valor unitario. Se nulo, mantem o valor atual (snapshot).
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(0, 999999.99, ErrorMessage = "Custo invalido.")]
    public decimal? Custo { get; set; }
}
