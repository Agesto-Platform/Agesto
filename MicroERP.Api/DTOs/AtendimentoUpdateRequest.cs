using MicroERP.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoUpdateRequest
{
    [Required(ErrorMessage = "Status obrigatorio.")]
    [EnumDataType(typeof(StatusAtendimento), ErrorMessage = "Status invalido.")]
    public StatusAtendimento Status { get; set; }

    // Reagendamento (full-replace): envie o valor atual para mantê-lo.
    public DateTime? DataAgendada { get; set; }
}
