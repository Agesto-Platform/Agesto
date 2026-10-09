using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class ConfiguracaoUpdateRequest
{
    [Required(ErrorMessage = "TipoOperacao é obrigatório.")]
    public TipoOperacao? TipoOperacao { get; set; }

    // Opcionais: quando nulos, o campo permanece inalterado.
    public ModoAgendaAgente? ModoAgendaAgente { get; set; }
    public bool? ControlaEstoque { get; set; }
}