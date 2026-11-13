namespace MicroERP.Api.Enums;

// Como o cliente do Dono pagou o atendimento (cobrança mínima no web, TASKS L5).
public enum FormaRecebimento
{
    Dinheiro,
    Pix,
    CartaoDebito,
    CartaoCredito,
    Boleto,
    Transferencia,
    Outro,
}
