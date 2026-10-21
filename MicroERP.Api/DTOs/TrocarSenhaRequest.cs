using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class TrocarSenhaRequest
{
    [Required(ErrorMessage = "Senha atual obrigatória.")]
    public string SenhaAtual { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nova senha obrigatória.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no mínimo 8 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres.")]
    public string NovaSenha { get; set; } = string.Empty;
}
