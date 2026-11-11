using MicroERP.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ServicoCreateRequest
{
    [Required(ErrorMessage = "Descrição obrigatória.")]
    [MinLength(2, ErrorMessage = "Descrição deve ter no mínimo 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string Descricao { get; set; } = string.Empty;

    [EnumDataType(typeof(TipoCobranca), ErrorMessage = "Tipo de cobrança inválido.")]
    public TipoCobranca TipoCobranca { get; set; } = TipoCobranca.PorHora;

    [Range(0.01, 999999.99, ErrorMessage = "Valor hora inválido.")]
    public decimal? ValorHora { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Valor empreitada inválido.")]
    public decimal? ValorEmpreitada { get; set; }

    [Range(1, 1440, ErrorMessage = "Duração inválida: informe de 1 a 1440 minutos.")]
    public int? DuracaoMinutos { get; set; }
}
