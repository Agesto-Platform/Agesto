using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AuthLoginRequest
{
    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatória.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no mínimo 8 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}
