using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AuthRegisterRequest
{
    [Required (ErrorMessage = "Nome da empresa obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome da empresa deve ter no mínimo 2 caracteres.")]
    [MaxLength(150, ErrorMessage = "Nome da empresa deve ter no máximo 150 caracteres.")]
    public string NomeEmpresa { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatória.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no mínimo 8 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}
