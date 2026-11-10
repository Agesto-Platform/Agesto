using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// ---------- autenticação da equipe do Agesto ----------

public sealed class AdminLoginRequest
{
    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no máximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatória.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}

// Primeiro admin (setup) e novos admins da equipe.
public sealed class AdminCriarRequest
{
    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no máximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email obrigatório.")]
    [EmailAddress(ErrorMessage = "Email inválido.")]
    [MaxLength(150, ErrorMessage = "Email deve ter no máximo 150 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Senha obrigatória.")]
    [MinLength(12, ErrorMessage = "Senha deve ter no mínimo 12 caracteres.")]
    [MaxLength(128, ErrorMessage = "Senha deve ter no máximo 128 caracteres.")]
    public string Senha { get; set; } = string.Empty;
}

public sealed class AdminAuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public AdminResponse Admin { get; set; } = new();
}

public sealed class AdminResponse
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool Ativo { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ---------- empresas clientes ----------

public sealed class EmpresaAdminResumo
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Documento { get; set; }
    public bool Ativa { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TotalUsuarios { get; set; }
    public int UsuariosAtivos { get; set; }
    public string? DonoNome { get; set; }
    public string? DonoEmail { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
}

public sealed class EmpresaAdminDetalhe
{
    public long Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Documento { get; set; }
    public bool Ativa { get; set; }
    public DateTime? BloqueadaEm { get; set; }
    public string? MotivoBloqueio { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TotalClientes { get; set; }
    public int TotalAtendimentos { get; set; }
    public DateTime? UltimoAcessoEm { get; set; }
    public IReadOnlyList<UsuarioAdminItem> Usuarios { get; set; } = [];
}

public sealed class UsuarioAdminItem
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

public sealed class EmpresaAdminCriarRequest
{
    [Required(ErrorMessage = "Nome da empresa obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome da empresa deve ter no mínimo 2 caracteres.")]
    [MaxLength(150, ErrorMessage = "Nome da empresa deve ter no máximo 150 caracteres.")]
    public string NomeEmpresa { get; set; } = string.Empty;

    [MaxLength(18, ErrorMessage = "Documento deve ter no máximo 18 caracteres.")]
    public string? Documento { get; set; }

    [Required(ErrorMessage = "Nome do dono obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome do dono deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome do dono deve ter no máximo 120 caracteres.")]
    public string NomeDono { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email do dono obrigatório.")]
    [EmailAddress(ErrorMessage = "Email do dono inválido.")]
    [MaxLength(150, ErrorMessage = "Email do dono deve ter no máximo 150 caracteres.")]
    public string EmailDono { get; set; } = string.Empty;
}

// A senha provisória aparece uma vez só, para a equipe repassar ao cliente.
public sealed class EmpresaAdminCriadaResponse
{
    public long EmpresaId { get; set; }
    public string EmailDono { get; set; } = string.Empty;
    public string SenhaProvisoria { get; set; } = string.Empty;
}

public sealed class EmpresaBloquearRequest
{
    [Required(ErrorMessage = "Motivo obrigatório.")]
    [MinLength(3, ErrorMessage = "Motivo deve ter no mínimo 3 caracteres.")]
    [MaxLength(300, ErrorMessage = "Motivo deve ter no máximo 300 caracteres.")]
    public string Motivo { get; set; } = string.Empty;
}

public sealed class SenhaProvisoriaAdminResponse
{
    public string Email { get; set; } = string.Empty;
    public string SenhaProvisoria { get; set; } = string.Empty;
}

// ---------- auditoria ----------

public sealed class AuditoriaAdminItem
{
    public long Id { get; set; }
    public string AdminNome { get; set; } = string.Empty;
    public string Acao { get; set; } = string.Empty;
    public long? EmpresaId { get; set; }
    public string? EmpresaNome { get; set; }
    public long? UsuarioId { get; set; }
    public string? Detalhes { get; set; }
    public DateTime CreatedAt { get; set; }
}
