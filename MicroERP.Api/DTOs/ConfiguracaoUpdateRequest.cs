using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class ConfiguracaoUpdateRequest
{
    [Required(ErrorMessage = "TipoOperacao é obrigatório.")]
    [EnumDataType(typeof(TipoOperacao), ErrorMessage = "TipoOperacao inválido.")]
    public TipoOperacao? TipoOperacao { get; set; }

    // Opcionais: quando nulos, o campo permanece inalterado.
    [EnumDataType(typeof(ModoAgendaAgente), ErrorMessage = "Modo de agenda inválido.")]
    public ModoAgendaAgente? ModoAgendaAgente { get; set; }
    public bool? ControlaEstoque { get; set; }
    public bool? AgenteCadastraServico { get; set; }
}