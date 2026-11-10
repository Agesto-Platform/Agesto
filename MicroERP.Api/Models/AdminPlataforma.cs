namespace MicroERP.Api.Models;

// Pessoa da equipe do Agesto com acesso à área de superadmin. Conta separada
// dos usuários das empresas: não pertence a nenhuma empresa e o token dela
// não abre as telas de cliente (outra audiência no JWT).
public class AdminPlataforma
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Senha { get; set; } = string.Empty;
    public bool Ativo { get; set; } = true;
    public DateTime? UltimoAcessoEm { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
