using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class TrocarSenhaRequest
{
    [Required(ErrorMessage = "Senha atual obrigatoria.")]
    public string SenhaAtual { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nova senha obrigatoria.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no minimo 8 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no maximo 128 caracteres.")]
    public string NovaSenha { get; set; } = string.Empty;
}
