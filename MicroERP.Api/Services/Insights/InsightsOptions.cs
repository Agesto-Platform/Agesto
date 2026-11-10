namespace MicroERP.Api.Services.Insights;

// Seção "Insights" da configuração (DEC-21). No Render: Insights__AnthropicApiKey.
// Sem chave (nem aqui nem em ANTHROPIC_API_KEY), a IA fica desligada e o
// endpoint responde 503, sem afetar o resto da API.
public sealed class InsightsOptions
{
    public const string Secao = "Insights";

    public string? AnthropicApiKey { get; set; }

    // A DEC-21 sugere um modelo econômico para o uso comum: dá para trocar aqui
    // (ex.: "claude-haiku-5-5") sem mudar código.
    public string Modelo { get; set; } = "claude-opus-5-5";

    // low | medium | high | xhigh | max. Interpretar métricas é tarefa simples.
    public string Esforco { get; set; } = "medium";

    public int MaxTokens { get; set; } = 16000;

    // Gerações por empresa por hora (controle de custo da DEC-21).
    public int LimitePorHora { get; set; } = 10;
}
