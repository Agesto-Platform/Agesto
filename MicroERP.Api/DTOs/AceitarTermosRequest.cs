using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AceitarTermosRequest
{
    [Required(ErrorMessage = "Versão dos termos é obrigatória.")]
    [MaxLength(20, ErrorMessage = "Versão dos termos inválida.")]
    public string Versao { get; set; } = string.Empty;
}
