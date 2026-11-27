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

    // Limite diário por empresa (DEC-21): quantas perguntas ainda restam hoje.
    public int PerguntasRestantes { get; set; }
    public int LimiteDiario { get; set; }

    // Rascunhos preparados pela IA para o Dono revisar (KAN-77).
    public List<AcaoAgenteResponse> Acoes { get; set; } = [];
}

// "whatsapp": o painel abre o WhatsApp do Dono com a mensagem pronta. O telefone
// sai do cadastro, nunca passa pelo modelo.
// "atendimento" (fase 2, DEC-63): mudança proposta num atendimento pendente. Nada
// muda até o Dono confirmar no painel, que relê o atendimento e só grava se ele
// ainda estiver como na proposta (status, data e responsável "atuais").
public sealed class AcaoAgenteResponse
{
    public string Tipo { get; set; } = string.Empty;
    public long ClienteId { get; set; }
    public string ClienteNome { get; set; } = string.Empty;
    public string Telefone { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;

    public long? AtendimentoId { get; set; }
    public string? Servico { get; set; }
    public DateTime? DataAtual { get; set; }
    public long? ResponsavelAtualId { get; set; }
    public string? ResponsavelAtualNome { get; set; }
    // Nulos = não mudam. NovoStatus: "Concluido" ou "Cancelado".
    public string? NovoStatus { get; set; }
    public DateTime? NovaData { get; set; }
    public long? NovoResponsavelId { get; set; }
    public string? NovoResponsavelNome { get; set; }
}
