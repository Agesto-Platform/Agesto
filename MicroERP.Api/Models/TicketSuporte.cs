using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;

// Chamado de suporte aberto pelo Dono no painel (DEC-60). A equipe do Agesto
// responde e avança o status no superadmin.
public class TicketSuporte
{
    public long Id { get; set; }
    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
    // Dono que abriu o chamado.
    public long UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public AssuntoTicket Assunto { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    public StatusTicket Status { get; set; } = StatusTicket.Aberto;
    public DateTime? ResolvidoEm { get; set; }

    public List<RespostaTicketSuporte> Respostas { get; set; } = [];
    public List<AnexoTicketSuporte> Anexos { get; set; } = [];

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }
}

// Arquivo (imagem ou PDF) anexado pelo Dono ao abrir o chamado (DEC-60). O
// conteúdo fica no bucket privado do Supabase Storage; aqui só o caminho.
public class AnexoTicketSuporte
{
    public long Id { get; set; }
    public long TicketId { get; set; }
    public TicketSuporte? Ticket { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Tamanho { get; set; }
    public string Caminho { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Resposta da equipe do Agesto a um chamado (DEC-60). Só cresce.
public class RespostaTicketSuporte
{
    public long Id { get; set; }
    public long TicketId { get; set; }
    public TicketSuporte? Ticket { get; set; }
    // Admin que respondeu; null se o admin foi removido.
    public long? AdminId { get; set; }
    public AdminPlataforma? Admin { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
