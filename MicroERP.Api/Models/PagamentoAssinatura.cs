using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;

// Pagamento da assinatura registrado pela equipe no superadmin (DEC-58). Não há
// gateway: cartão, boleto ou Pix são combinados no contato (DEC-57). Cada
// pagamento cobre um período e leva o "pago até" da empresa para o fim dele.
public class PagamentoAssinatura
{
    public long Id { get; set; }
    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
    /// <summary>Admin que registrou; null se o admin foi removido.</summary>
    public long? AdminId { get; set; }

    public decimal Valor { get; set; }
    public DateOnly PagoEm { get; set; }
    public FormaPagamento Forma { get; set; }
    public int Meses { get; set; } = 1;
    public DateOnly PeriodoInicio { get; set; }
    public DateOnly PeriodoFim { get; set; }
    public string? Observacao { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
