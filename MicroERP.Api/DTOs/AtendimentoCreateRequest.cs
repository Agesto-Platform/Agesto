using MicroERP.Api.Enums;
using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoCreateRequest
{
    [Required(ErrorMessage = "Cliente obrigatório.")]
    [Range(1, long.MaxValue, ErrorMessage = "Cliente inválido.")]
    public long ClienteId { get; set; }

    [Required(ErrorMessage = "Status obrigatório.")]
    [EnumDataType(typeof(StatusAtendimento), ErrorMessage = "Status inválido.")]
    public StatusAtendimento Status { get; set; }

    public DateTime? DataRegistro { get; set; }

    // Data/hora marcada para o atendimento (agenda de campo). Opcional.
    public DateTime? DataAgendada { get; set; }
}
