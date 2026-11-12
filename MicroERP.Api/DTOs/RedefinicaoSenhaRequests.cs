using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

// "Esqueci a senha" do Dono (DEC-54).
public sealed class EsqueciSenhaRequest
{
    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no máximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;
}

public sealed class RedefinirSenhaRequest
{
    [Required(ErrorMessage = "Link inválido ou expirado. Peça um novo.")]
    [MaxLength(100, ErrorMessage = "Link inválido ou expirado. Peça um novo.")]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessage = "Nova senha obrigatória.")]
    [MinLength(8, ErrorMessage = "Senha deve ter no mínimo 8 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres.")]
    public string NovaSenha { get; set; } = string.Empty;
}
