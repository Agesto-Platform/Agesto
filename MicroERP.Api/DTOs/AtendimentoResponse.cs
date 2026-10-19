using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public DateTime DataRegistro { get; set; }
    public DateTime? DataAgendada { get; set; }
    public StatusAtendimento Status { get; set; }
    public decimal ValorTotal { get; set; }
    public decimal CustoTotal { get; set; }
    public decimal Margem { get; set; }
    public long ClienteId { get; set; }
    public long UsuarioId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}