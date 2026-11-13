using System.Text.Encodings.Web;
using System.Text.Json;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// IA nativa (DEC-21): lê as métricas já agregadas da empresa do token (DEC-20)
// e pede a interpretação ao modelo. Só leitura; nenhum dado bruto nem pessoal
// (CPF, nome de cliente) sai daqui, porque o dashboard só tem agregados.
public sealed class InsightsService : IInsightsService
{
    // Acentos sem escape (ç): o JSON vai para o modelo, não para HTML.
    private static readonly JsonSerializerOptions JsonEnvio = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly IMetricasService _metricasService;
    private readonly IInsightsGerador _gerador;
    private readonly IUsoIaService _usoIa;
    private readonly ILogger<InsightsService> _logger;

    public InsightsService(IMetricasService metricasService, IInsightsGerador gerador, IUsoIaService usoIa, ILogger<InsightsService> logger)
    {
        _metricasService = metricasService;
        _gerador = gerador;
        _usoIa = usoIa;
        _logger = logger;
    }

    public async Task<InsightsResponse> GerarAsync(long empresaId, DateTime? de, DateTime? ate, CancellationToken cancellationToken)
    {
        if (!_gerador.Habilitado)
            throw new InsightsIndisponivelException("A IA não está configurada neste servidor.");

        var dashboard = await _metricasService.GetDashboardAsync(empresaId, de, ate, cancellationToken);
        var metricasJson = JsonSerializer.Serialize(dashboard, JsonEnvio);

        var gerados = await _gerador.GerarAsync(metricasJson, cancellationToken);

        // Consumo por empresa e dia (DEC-21). Relatórios não têm limite diário;
        // continuam limitados por hora no rate limiter.
        await _usoIa.RegistrarRelatorioAsync(empresaId, gerados.TokensEntrada, gerados.TokensSaida, CancellationToken.None);
        _logger.LogInformation(
            "Insights IA gerados: empresa {EmpresaId}, modelo {Modelo}, tokens de entrada {TokensEntrada}, tokens de saída {TokensSaida}",
            empresaId, gerados.Modelo, gerados.TokensEntrada, gerados.TokensSaida);

        return new InsightsResponse
        {
            De = dashboard.De,
            Ate = dashboard.Ate,
            Resumo = gerados.Resumo,
            Destaques = gerados.Destaques,
            Alertas = gerados.Alertas,
            Recomendacoes = gerados.Recomendacoes,
            Modelo = gerados.Modelo,
            GeradoEm = DateTime.UtcNow,
        };
    }
}
