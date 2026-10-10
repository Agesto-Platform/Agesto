using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoUpdateRequest
{
    // Opcional: sobrescreve o valor unitario. Se nulo, mantem o valor atual (snapshot).
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(1, 9999, ErrorMessage = "Quantidade invalida.")]
    public int Quantidade { get; set; }
}
