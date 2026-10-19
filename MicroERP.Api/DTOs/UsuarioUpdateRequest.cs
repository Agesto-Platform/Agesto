using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class UsuarioUpdateRequest
{
    [Required(ErrorMessage = "Nome obrigatorio.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no minimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no maximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Perfil obrigatorio.")]
    [EnumDataType(typeof(PerfilUsuario), ErrorMessage = "Perfil invalido.")]
    public PerfilUsuario Perfil { get; set; }
}
