using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Chamado novo do Dono (DEC-60). Empresa e autor vêm do token.
public sealed class TicketCriarRequest
{
    [EnumDataType(typeof(AssuntoTicket), ErrorMessage = "Assunto inválido.")]
    public AssuntoTicket Assunto { get; set; }

    [Required(ErrorMessage = "Escreva a mensagem.")]
    [MinLength(10, ErrorMessage = "Escreva pelo menos 10 caracteres.")]
    [MaxLength(4000, ErrorMessage = "A mensagem deve ter no máximo 4000 caracteres.")]
    public string Mensagem { get; set; } = string.Empty;
}

// Resposta da equipe; pode avançar o status junto.
public sealed class TicketResponderRequest
{
    [Required(ErrorMessage = "Escreva a resposta.")]
    [MinLength(2, ErrorMessage = "Escreva a resposta.")]
    [MaxLength(4000, ErrorMessage = "A resposta deve ter no máximo 4000 caracteres.")]
    public string Mensagem { get; set; } = string.Empty;

    [EnumDataType(typeof(StatusTicket), ErrorMessage = "Status inválido.")]
    public StatusTicket? Status { get; set; }
}

public sealed class TicketStatusRequest
{
    [EnumDataType(typeof(StatusTicket), ErrorMessage = "Status inválido.")]
    public StatusTicket Status { get; set; }
}

public sealed class AnexoTicketResponse
{
    public long Id { get; set; }
    public string NomeArquivo { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Tamanho { get; set; }
    // Link temporário (10 minutos) para abrir o arquivo; null se o Storage falhar.
    public string? Url { get; set; }
}

// Arquivo recebido no formulário, já lido para a memória (no máximo 5 MB).
public sealed record ArquivoRecebido(string Nome, byte[] Conteudo);

public sealed class RespostaTicketResponse
{
    public long Id { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    // Nome de quem respondeu pela equipe ("Equipe Agesto" se o admin não existe mais).
    public string Autor { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public sealed class TicketResponse
{
    public long Id { get; set; }
    public AssuntoTicket Assunto { get; set; }
    public StatusTicket Status { get; set; }
    public string Mensagem { get; set; } = string.Empty;
    public int TotalRespostas { get; set; }
    public int TotalAnexos { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ResolvidoEm { get; set; }
    // Preenchidos só no superadmin.
    public long? EmpresaId { get; set; }
    public string? EmpresaNome { get; set; }
    public string? DonoNome { get; set; }
    public string? DonoEmail { get; set; }
    // Preenchidas só no detalhe.
    public List<RespostaTicketResponse>? Respostas { get; set; }
    public List<AnexoTicketResponse>? Anexos { get; set; }
}
