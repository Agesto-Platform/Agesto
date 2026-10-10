using MicroERP.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoCreateRequest
{
    [Required(ErrorMessage = "Cliente obrigatorio.")]
    [Range(1, long.MaxValue, ErrorMessage = "Cliente invalido.")]
    public long ClienteId { get; set; }

    [Required(ErrorMessage = "Status obrigatorio.")]
    [EnumDataType(typeof(StatusAtendimento), ErrorMessage = "Status invalido.")]
    public StatusAtendimento Status { get; set; }

    public DateTime? DataRegistro { get; set; }

    // Data/hora marcada para o atendimento (agenda de campo). Opcional.
    public DateTime? DataAgendada { get; set; }
}
