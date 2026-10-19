using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class UsuarioCreateRequest
{
    [Required(ErrorMessage = "Nome obrigatorio.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no minimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no maximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email obrigatorio.")]
    [EmailAddress(ErrorMessage = "Email invalido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no maximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [EnumDataType(typeof(PerfilUsuario), ErrorMessage = "Perfil invalido.")]
    public PerfilUsuario Perfil { get; set; } = PerfilUsuario.Agente;
}
