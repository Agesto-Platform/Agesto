using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class OrcamentoUpdateRequest
{
    // Nesta fase o update altera apenas o status (Rascunho/Enviado/Aprovado/Recusado).
    // Edicao de itens: criar um novo orcamento.
    [Required(ErrorMessage = "Status obrigatorio.")]
    [EnumDataType(typeof(StatusOrcamento), ErrorMessage = "Status invalido.")]
    public StatusOrcamento Status { get; set; }
}
