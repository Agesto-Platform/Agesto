using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Serviço criado pelo agente no app, offline (DEC-36). O Uuid do device garante
// idempotência no reenvio e liga os itens de atendimento da mesma leva.
public sealed class ServicoSyncRequest
{
    public Guid Uuid { get; set; }

    [Required(ErrorMessage = "Descricao obrigatoria.")]
    [MinLength(2, ErrorMessage = "Descricao deve ter no minimo 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string Descricao { get; set; } = string.Empty;

    [EnumDataType(typeof(TipoCobranca), ErrorMessage = "Tipo de cobranca invalido.")]
    public TipoCobranca TipoCobranca { get; set; } = TipoCobranca.PorHora;

    [Range(0.01, 999999.99, ErrorMessage = "Valor hora invalido.")]
    public decimal? ValorHora { get; set; }

    [Range(0.01, 999999.99, ErrorMessage = "Valor empreitada invalido.")]
    public decimal? ValorEmpreitada { get; set; }
}
