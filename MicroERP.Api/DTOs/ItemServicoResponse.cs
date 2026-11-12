using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public long AtendimentoId { get; set; }
    public long ServicoId { get; set; }
    // PAG-01: descrição e cobrança do serviço, mesmo já excluído do catálogo.
    public string? ServicoDescricao { get; set; }
    public TipoCobranca? TipoCobranca { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
