namespace MicroERP.Api.Services.Insights;

// Seção "Insights" da configuração (DEC-21). No Render: Insights__AnthropicApiKey.
// Sem chave (nem aqui nem em ANTHROPIC_API_KEY), a IA fica desligada e o
// endpoint responde 503, sem afetar o resto da API.
public sealed class InsightsOptions
{
    public const string Secao = "Insights";

    public string? AnthropicApiKey { get; set; }

    // Modelo econômico para o uso comum (DEC-21). Para um modelo mais capaz,
    // configure Insights__Modelo (ex.: "claude-opus-5-5") sem mudar código.
    public string Modelo { get; set; } = "claude-haiku-5-5";

    // low | medium | high | xhigh | max. Interpretar métricas é tarefa simples.
    public string Esforco { get; set; } = "medium";

    public int MaxTokens { get; set; } = 16000;

    // Teto por resposta do chat do Agente (inclui o raciocínio do modelo).
    public int MaxTokensAgente { get; set; } = 4000;

    // Gerações de insights por empresa por hora (controle de custo da DEC-21).
    public int LimitePorHora { get; set; } = 10;

    // Perguntas ao Agente por empresa por hora.
    public int LimitePerguntasPorHora { get; set; } = 30;

    // Perguntas ao Agente por empresa por dia de Brasília, guardadas no banco
    // (UsosIa). Definido pelo Davi em 13/11/2026 (DEC-21).
    public int PerguntasPorDia { get; set; } = 20;
}
