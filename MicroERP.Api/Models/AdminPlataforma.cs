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
    // Quando criou a senha pelo link do convite (DEC-55). Nulo = convite pendente.
    public DateTime? EmailConfirmadoEm { get; set; }

    // Bloqueio por conta (DEC-52, igual ao do usuário na DEC-43): 5 senhas erradas
    // seguidas bloqueiam o login por 15 minutos.
    public int TentativasLoginFalhas { get; set; }
    public DateTime? BloqueadoAte { get; set; }

    // Verificação em duas etapas por email (DEC-52): depois da senha, um código de
    // 6 dígitos vale 10 minutos e só junto com o desafio daquele login. Guardamos
    // só os hashes; 5 códigos errados invalidam o desafio.
    public string? DesafioLoginHash { get; set; }
    public string? CodigoLoginHash { get; set; }
    public DateTime? CodigoLoginExpiraEm { get; set; }
    public int CodigoLoginTentativas { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
