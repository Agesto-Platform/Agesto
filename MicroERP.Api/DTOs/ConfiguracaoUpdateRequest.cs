using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class ConfiguracaoUpdateRequest
{
    [Required(ErrorMessage = "TipoOperacao e obrigatorio.")]
    [EnumDataType(typeof(TipoOperacao), ErrorMessage = "TipoOperacao invalido.")]
    public TipoOperacao? TipoOperacao { get; set; }

    // Opcionais: quando nulos, o campo permanece inalterado.
    [EnumDataType(typeof(ModoAgendaAgente), ErrorMessage = "Modo de agenda invalido.")]
    public ModoAgendaAgente? ModoAgendaAgente { get; set; }
    public bool? ControlaEstoque { get; set; }
}