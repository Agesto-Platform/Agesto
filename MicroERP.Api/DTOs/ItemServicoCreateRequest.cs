using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoCreateRequest
{
    [Required(ErrorMessage = "Atendimento obrigatorio.")]
    [Range(1, long.MaxValue, ErrorMessage = "Atendimento invalido.")]
    public long AtendimentoId { get; set; }

    [Required(ErrorMessage = "Servico obrigatorio.")]
    [Range(1, long.MaxValue, ErrorMessage = "Servico invalido.")]
    public long ServicoId { get; set; }

    // Opcional: sobrescreve o valor do catalogo (ValorHora/ValorEmpreitada) conforme
    // dificuldade/situacao (DEC-23). Se nulo, usa o valor do catalogo como default.
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }

    [Range(1, 9999, ErrorMessage = "Quantidade invalida.")]
    public int Quantidade { get; set; }
}
