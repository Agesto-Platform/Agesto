namespace MicroERP.Api.Models;

using MicroERP.Api.Enums;

public class Usuario
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Senha { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public long EmpresaId { get; set; }
    public PerfilUsuario Perfil { get; set; } = PerfilUsuario.Dono;

    // Desativado perde o acesso na hora (TokenRevalidator) e não faz login.
    public bool Ativo { get; set; } = true;
    // Senha provisória definida pelo Dono: o app pede a troca no primeiro acesso.
    public bool DeveTrocarSenha { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
    public Empresa? Empresa { get; set; }
}
