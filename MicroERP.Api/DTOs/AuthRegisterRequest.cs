using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class AuthRegisterRequest
{
    [Required (ErrorMessage = "Nome da empresa obrigatorio.")]
    [MinLength(2, ErrorMessage = "Nome da empresa deve ter no minimo 2 caracteres.")]
    [MaxLength(150, ErrorMessage = "Nome da empresa deve ter no maximo 150 caracteres.")]
    public string NomeEmpresa { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nome obrigatorio.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no minimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no maximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email obrigatorio.")]
    [EmailAddress(ErrorMessage = "Email invalido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no maximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatoria.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no minimo 8 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no maximo 128 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}
