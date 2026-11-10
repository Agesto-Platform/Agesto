namespace MicroERP.Api.Services.Insights;

// Fronteira com o provedor de IA: recebe dados já calculados (DEC-20) e devolve
// a interpretação. Isolada para os serviços serem testáveis sem rede.
public interface IInsightsGerador
{
    bool Habilitado { get; }

    // Relatório em quatro blocos para POST /api/insights.
    Task<InsightsGerados> GerarAsync(string metricasJson, CancellationToken cancellationToken);

    // Conversa do painel Agente. A conversa começa e termina com o usuário e
    // alterna os papéis; a última mensagem já traz os dados e a pergunta.
    Task<RespostaIA> ResponderAsync(IReadOnlyList<MensagemIA> conversa, CancellationToken cancellationToken);
}

public sealed record MensagemIA(bool DoUsuario, string Texto);

public sealed record RespostaIA(string Texto, string Modelo, long TokensEntrada, long TokensSaida);

public sealed class InsightsGerados
{
    public string Resumo { get; set; } = string.Empty;
    public List<string> Destaques { get; set; } = [];
    public List<string> Alertas { get; set; } = [];
    public List<string> Recomendacoes { get; set; } = [];

    // Preenchidos pelo gerador, não pelo modelo.
    public string Modelo { get; set; } = string.Empty;
    public long TokensEntrada { get; set; }
    public long TokensSaida { get; set; }
}

// IA desligada, recusada ou fora do ar: o controller responde 503.
public sealed class InsightsIndisponivelException : Exception
{
    public InsightsIndisponivelException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}
