using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoUpdateRequest
{
    // Opcional: sobrescreve o valor unitario. Se nulo, mantem o valor atual (snapshot).
    [Range(0, double.MaxValue, ErrorMessage = "Valor unitário inválido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Quantidade inválida.")]
    public int Quantidade { get; set; }
}
