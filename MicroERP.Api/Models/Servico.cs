using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;

public class Servico
{
    public long Id { get; set; }
    public Guid Uuid { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public TipoCobranca TipoCobranca { get; set; } = TipoCobranca.PorHora;
    public decimal? ValorHora { get; set; }
    public decimal? ValorEmpreitada { get; set; }
    // Tempo estimado de execução: base da receita por hora dos serviços por empreitada.
    public int? DuracaoMinutos { get; set; }
    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    // Serviço criado pelo agente em campo (DEC-36): entra no catálogo na hora e
    // fica marcado até o Dono revisar preço e descrição. Criado pelo Dono = revisado.
    public long? CriadoPorUsuarioId { get; set; }
    public Usuario? CriadoPor { get; set; }
    public bool Revisado { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}
