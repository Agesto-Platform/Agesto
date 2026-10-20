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
}
