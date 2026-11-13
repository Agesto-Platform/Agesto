namespace MicroERP.Api.Enums;

// Forma do pagamento da assinatura, combinada no contato (DEC-57, DEC-58).
public enum FormaPagamento
{
    Pix,
    Boleto,
    Cartao,
    Outro,
}

// Situação da assinatura calculada a partir do "pago até" (DEC-58).
public enum SituacaoAssinatura
{
    /// <summary>Sem "pago até": conta de teste ou ainda sem pagamento; nunca é bloqueada sozinha.</summary>
    SemCobranca,
    EmDia,
    /// <summary>Vence em até 5 dias.</summary>
    VenceEmBreve,
    /// <summary>Venceu há até 10 dias: o acesso continua, com aviso.</summary>
    EmCarencia,
    /// <summary>Venceu há mais de 10 dias: bloqueio automático.</summary>
    Atrasada,
}
