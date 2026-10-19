using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class ServicoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public decimal? ValorHora { get; set; }
    public decimal? ValorEmpreitada { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public TipoCobranca TipoCobranca { get; set; }
    // false = criado pelo agente em campo, aguardando revisão do Dono.
    public bool Revisado { get; set; } = true;
    public long? CriadoPorUsuarioId { get; set; }
    public string? CriadoPorNome { get; set; }
}
