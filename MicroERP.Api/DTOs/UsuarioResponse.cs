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
    // A pessoa ainda não criou a senha pelo link do convite (DEC-55).
    public bool ConvitePendente { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Acesso criado ou convite reenviado (DEC-55). EnvioHabilitado = false quando o
// Brevo não está configurado: o convite existe, mas o email não sai.
public sealed class UsuarioConviteResponse
{
    public UsuarioResponse Usuario { get; set; } = new();
    public bool EnvioHabilitado { get; set; }
}
