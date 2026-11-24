using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class UsuarioUpdateRequest
{
    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no máximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Perfil obrigatório.")]
    [EnumDataType(typeof(PerfilUsuario), ErrorMessage = "Perfil inválido.")]
    public PerfilUsuario Perfil { get; set; }

    // Email real da pessoa, obrigatório ao promover um Agente a Dono (KAN-32): o login do
    // agente pode ser inventado (DEC-59), mas o Dono precisa do "Esqueci a senha".
    [EmailAddress(ErrorMessage = "Email inválido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no máximo 150 caracteres.")]
    public string? Email { get; set; }
}
