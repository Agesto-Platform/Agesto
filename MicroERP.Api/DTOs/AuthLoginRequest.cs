using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AuthLoginRequest
{
    [Required(ErrorMessage = "Email obrigatorio.")]
    [EmailAddress(ErrorMessage = "Email invalido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no maximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatoria.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no minimo 8 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no maximo 128 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}
