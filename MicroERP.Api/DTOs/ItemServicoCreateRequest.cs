using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoCreateRequest
{
    [Required(ErrorMessage = "Atendimento obrigatório.")]
    [Range(1, long.MaxValue, ErrorMessage = "Atendimento inválido.")]
    public long AtendimentoId { get; set; }

    [Required(ErrorMessage = "Serviço obrigatório.")]
    [Range(1, long.MaxValue, ErrorMessage = "Serviço inválido.")]
    public long ServicoId { get; set; }

    // Opcional: sobrescreve o valor do catalogo (ValorHora/ValorEmpreitada) conforme
    // dificuldade/situacao (DEC-23). Se nulo, usa o valor do catalogo como default.
    [Range(0, double.MaxValue, ErrorMessage = "Valor unitário inválido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Quantidade inválida.")]
    public int Quantidade { get; set; }
}
