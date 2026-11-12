namespace MicroERP.Api.Models;

// "Esqueci a senha" do Dono (DEC-54). O token vai só no email; aqui fica o hash
// SHA-256 dele, a validade de 15 minutos e quando foi usado (uso único).
// Não é dado operacional da empresa: nunca é apagado, só marcado como usado.
public class TokenRedefinicaoSenha
{
    public long Id { get; set; }
    public long UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    // SHA-256 em hexadecimal do token enviado no link.
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
    // Preenchido ao redefinir a senha ou quando um pedido novo invalida este.
    public DateTime? UsadoEm { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
