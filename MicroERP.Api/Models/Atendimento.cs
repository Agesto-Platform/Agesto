using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;
public class Atendimento
{
    public long Id { get; set; }
    public Guid Uuid { get; set; }
    public DateTime DataRegistro { get; set; }
    public DateTime? DataAgendada { get; set; }
    public StatusAtendimento Status { get; set; } = StatusAtendimento.Pendente;
    public decimal ValorTotal { get; set; }
    public decimal CustoTotal { get; set; }
    // Cobrança mínima (TASKS L5): quando e como o cliente pagou. Null = a receber.
    public DateOnly? PagoEm { get; set; }
    public FormaRecebimento? FormaPagamento { get; set; }
    public long EmpresaId { get; set; } // Empresa
    public long UsuarioId { get; set; } // Usuario que registrou o atendimento
    public Empresa? Empresa { get; set; }
    public long ClienteId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public Cliente? Cliente { get; set; }
    public ICollection<ItemProduto> ItensProduto { get; set; } = new List<ItemProduto>();
    public ICollection<ItemServico> ItensServico { get; set; } = new List<ItemServico>();
}
