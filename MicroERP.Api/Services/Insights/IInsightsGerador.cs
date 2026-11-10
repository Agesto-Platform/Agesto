namespace MicroERP.Api.Services.Insights;

// Fronteira com o provedor de IA: recebe as métricas já calculadas (DEC-20)
// e devolve a interpretação. Isolada para o serviço ser testável sem rede.
public interface IInsightsGerador
{
    bool Habilitado { get; }

    Task<InsightsGerados> GerarAsync(string metricasJson, CancellationToken cancellationToken);
}

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
