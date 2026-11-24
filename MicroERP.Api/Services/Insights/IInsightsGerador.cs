using System.Text.Json;

namespace MicroERP.Api.Services.Insights;

// Fronteira com o provedor de IA: recebe dados já calculados (DEC-20) e devolve
// a interpretação. Isolada para os serviços serem testáveis sem rede.
public interface IInsightsGerador
{
    bool Habilitado { get; }

    // Relatório em quatro blocos para POST /api/insights.
    Task<InsightsGerados> GerarAsync(string metricasJson, CancellationToken cancellationToken);

    // Conversa do painel Agente. A conversa começa e termina com o usuário e
    // alterna os papéis; a última mensagem já traz os dados e a pergunta. Com
    // ferramentas, o modelo pode consultar o sistema antes de responder.
    Task<RespostaIA> ResponderAsync(IReadOnlyList<MensagemIA> conversa, IExecutorDeFerramentas? ferramentas, CancellationToken cancellationToken);
}

// Consultas que o modelo pode pedir no chat do Agente (KAN-77, fase 1: só leitura).
// Quem implementa já nasce preso à empresa do login: o modelo nunca escolhe a empresa.
public interface IExecutorDeFerramentas
{
    IReadOnlyList<FerramentaIA> Ferramentas { get; }

    // Resultado que volta ao modelo (JSON ou texto). Entrada inválida ou registro
    // que não existe: FerramentaInvalidaException, devolvida ao modelo como erro.
    Task<string> ExecutarAsync(string nome, JsonElement entrada, CancellationToken cancellationToken);
}

// Propriedades: o JSON Schema de cada parâmetro.
public sealed record FerramentaIA(
    string Nome,
    string Descricao,
    IReadOnlyDictionary<string, JsonElement> Propriedades,
    IReadOnlyList<string> Obrigatorias);

public sealed class FerramentaInvalidaException : Exception
{
    public FerramentaInvalidaException(string message) : base(message)
    {
    }
}

public sealed record MensagemIA(bool DoUsuario, string Texto);

// Tokens somados de todas as chamadas ao modelo da pergunta.
public sealed record RespostaIA(string Texto, string Modelo, long TokensEntrada, long TokensSaida, int ConsultasFeitas = 0);

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
