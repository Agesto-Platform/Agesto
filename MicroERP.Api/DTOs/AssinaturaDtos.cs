using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Assinatura da empresa (DEC-58): o Dono vê no painel; a equipe, no superadmin.
public sealed class AssinaturaResponse
{
    public SituacaoAssinatura Situacao { get; set; }
    /// <summary>Último dia coberto pelos pagamentos; null = sem cobrança.</summary>
    public DateOnly? PagoAte { get; set; }
    public int? DiasParaVencer { get; set; }
    public int? DiasDeAtraso { get; set; }
    /// <summary>Na carência: quantos dias faltam para o bloqueio automático.</summary>
    public int? DiasParaBloqueio { get; set; }
    /// <summary>Funcionários que a assinatura cobre (1 incluso + extras).</summary>
    public int LicencasFuncionarios { get; set; }
    /// <summary>Acessos ativos da empresa (o Dono e os funcionários).</summary>
    public int AcessosEmUso { get; set; }
    /// <summary>Limite de acessos: o Dono mais as licenças de funcionário.</summary>
    public int AcessosPermitidos { get; set; }
    public decimal ValorMensal { get; set; }
    public bool Ativa { get; set; }
    public bool BloqueioAutomatico { get; set; }
    /// <summary>Só no superadmin.</summary>
    public IReadOnlyList<PagamentoAssinaturaItem> Pagamentos { get; set; } = [];
}

public sealed class PagamentoAssinaturaItem
{
    public long Id { get; set; }
    public decimal Valor { get; set; }
    public DateOnly PagoEm { get; set; }
    public FormaPagamento Forma { get; set; }
    public int Meses { get; set; }
    public DateOnly PeriodoInicio { get; set; }
    public DateOnly PeriodoFim { get; set; }
    public string? Observacao { get; set; }
    public string? AdminNome { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DesfeitoEm { get; set; }
    public string? DesfeitoPor { get; set; }
    /// <summary>Só o último pagamento ativo pode ser desfeito.</summary>
    public bool PodeDesfazer { get; set; }
}

public sealed class PagamentoAssinaturaRequest
{
    [Range(0.01, 100000, ErrorMessage = "Valor inválido.")]
    public decimal Valor { get; set; }

    [Required(ErrorMessage = "Data do pagamento obrigatória.")]
    public DateOnly? PagoEm { get; set; }

    public FormaPagamento Forma { get; set; } = FormaPagamento.Pix;

    [Range(1, 12, ErrorMessage = "O pagamento cobre de 1 a 12 meses.")]
    public int Meses { get; set; } = 1;

    [MaxLength(300, ErrorMessage = "Observação deve ter no máximo 300 caracteres.")]
    public string? Observacao { get; set; }
}

public sealed class AssinaturaAtualizarRequest
{
    [Range(1, 999, ErrorMessage = "Licenças de funcionário: de 1 a 999.")]
    public int LicencasFuncionarios { get; set; } = 1;

    /// <summary>Ajuste manual do "pago até" (ex.: mês de cortesia). Null = sem cobrança.</summary>
    public DateOnly? PagoAte { get; set; }
}
