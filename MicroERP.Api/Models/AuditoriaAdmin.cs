namespace MicroERP.Api.Models;

// Registro de cada ação feita na área de superadmin (quem, o quê, em qual
// empresa/usuário e quando). Só cresce: não é editado nem apagado pela API.
public class AuditoriaAdmin
{
    public long Id { get; set; }
    public long AdminId { get; set; }
    public string Acao { get; set; } = string.Empty;
    public long? EmpresaId { get; set; }
    public long? UsuarioId { get; set; }
    public string? Detalhes { get; set; }
    public string? Ip { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AdminPlataforma? Admin { get; set; }
}
