using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;

// Link por email para criar ou redefinir a senha (DEC-54 e DEC-55). Serve aos
// usuários das empresas (UsuarioId) e à equipe do Agesto (AdminId): sempre um
// dos dois. O token vai só no email; aqui fica o hash SHA-256 dele, a validade
// e quando foi usado (uso único). Nunca é apagado, só marcado como usado.
public class TokenRedefinicaoSenha
{
    public long Id { get; set; }
    public long? UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }
    public long? AdminId { get; set; }
    public AdminPlataforma? Admin { get; set; }

    public TipoTokenSenha Tipo { get; set; } = TipoTokenSenha.Redefinicao;

    // SHA-256 em hexadecimal do token enviado no link.
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
    // Preenchido ao criar a senha ou quando um link novo invalida este.
    public DateTime? UsadoEm { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
