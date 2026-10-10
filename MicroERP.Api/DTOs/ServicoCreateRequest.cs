using MicroERP.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ServicoCreateRequest
{
    [Required(ErrorMessage = "Descricao obrigatoria.")]
    [MinLength(2, ErrorMessage = "Descricao deve ter no minimo 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string Descricao { get; set; } = string.Empty;

    [EnumDataType(typeof(TipoCobranca), ErrorMessage = "Tipo de cobranca invalido.")]
    public TipoCobranca TipoCobranca { get; set; } = TipoCobranca.PorHora;

    [Range(0.01, 999999.99, ErrorMessage = "Valor hora invalido.")]
    public decimal? ValorHora { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Valor empreitada invalido.")]
    public decimal? ValorEmpreitada { get; set; }

}
