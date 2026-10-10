using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoUpdateRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Quantidade inválida.")]
    public int Quantidade { get; set; }

    // Opcional: corrige a descricao (util para itens avulsos). Se nulo, mantem a atual.
    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Opcional: sobrescreve o valor unitario. Se nulo, mantem o valor atual (snapshot).
    [Range(0, double.MaxValue, ErrorMessage = "Valor unitário inválido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Custo inválido.")]
    public decimal? Custo { get; set; }
}
