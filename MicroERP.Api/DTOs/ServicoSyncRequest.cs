using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Serviço criado pelo agente no app, offline (DEC-36). O Uuid do device garante
// idempotência no reenvio e liga os itens de atendimento da mesma leva.
public sealed class ServicoSyncRequest
{
    public Guid Uuid { get; set; }

    [Required(ErrorMessage = "Descrição obrigatória.")]
    [MinLength(2, ErrorMessage = "Descrição deve ter no mínimo 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string Descricao { get; set; } = string.Empty;

    [EnumDataType(typeof(TipoCobranca), ErrorMessage = "Tipo de cobrança inválido.")]
    public TipoCobranca TipoCobranca { get; set; } = TipoCobranca.PorHora;

    [Range(0.01, 999999.99, ErrorMessage = "Valor hora inválido.")]
    public decimal? ValorHora { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Valor empreitada inválido.")]
    public decimal? ValorEmpreitada { get; set; }
}
