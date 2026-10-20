using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class UsuarioCreateRequest
{
    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no máximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no máximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [EnumDataType(typeof(PerfilUsuario), ErrorMessage = "Perfil inválido.")]
    public PerfilUsuario Perfil { get; set; } = PerfilUsuario.Agente;
}
