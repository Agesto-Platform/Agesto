using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class UsuarioResponse
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public PerfilUsuario Perfil { get; set; }
    public bool Ativo { get; set; }
    public bool DeveTrocarSenha { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Devolvida só na criação e na redefinição: a senha provisória não é guardada
// em texto e não pode ser consultada depois.
public sealed class UsuarioSenhaProvisoriaResponse
{
    public UsuarioResponse Usuario { get; set; } = new();
    public string SenhaProvisoria { get; set; } = string.Empty;
}
