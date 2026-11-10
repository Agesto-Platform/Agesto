using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

// Pergunta do painel Agente. O histórico fica no navegador e volta a cada
// pergunta (a API não guarda conversa); De/Ate é o período do topo do painel.
public sealed class AgentePerguntaRequest
{
    [Required(ErrorMessage = "Pergunta obrigatória.")]
    [MaxLength(500, ErrorMessage = "Pergunta deve ter no máximo 500 caracteres.")]
    public string Pergunta { get; set; } = string.Empty;

    [MaxLength(10, ErrorMessage = "Histórico deve ter no máximo 10 mensagens.")]
    public List<AgenteMensagemRequest> Historico { get; set; } = [];

    public DateTime? De { get; set; }
    public DateTime? Ate { get; set; }
}

public sealed class AgenteMensagemRequest
{
    [Required(ErrorMessage = "Papel obrigatório.")]
    [RegularExpression("^(usuario|agente)$", ErrorMessage = "Papel deve ser 'usuario' ou 'agente'.")]
    public string Papel { get; set; } = string.Empty;

    [Required(ErrorMessage = "Texto obrigatório.")]
    [MaxLength(2000, ErrorMessage = "Mensagem do histórico deve ter no máximo 2000 caracteres.")]
    public string Texto { get; set; } = string.Empty;
}

public sealed class AgenteRespostaResponse
{
    public string Resposta { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
}
