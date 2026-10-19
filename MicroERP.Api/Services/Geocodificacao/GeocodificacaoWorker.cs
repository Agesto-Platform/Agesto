using MicroERP.Api.Data;

namespace MicroERP.Api.Services.Geocodificacao;

// Geocodifica em segundo plano clientes novos, com endereço alterado e os já
// existentes (conversão inicial). Fora da requisição para não atrasar cadastro
// nem sync. Respeita a cota gratuita do OpenRouteService (~100 por minuto).
public sealed class GeocodificacaoWorker : BackgroundService
{
    private const int TamanhoDoLote = 25;
    private static readonly TimeSpan IntervaloEntreChamadas = TimeSpan.FromMilliseconds(1500);
    private static readonly TimeSpan EsperaSemPendentes = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan EsperaAposFalha = TimeSpan.FromMinutes(10);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<GeocodificacaoWorker> _logger;

    public GeocodificacaoWorker(IServiceScopeFactory scopeFactory, ILogger<GeocodificacaoWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using (var scope = _scopeFactory.CreateScope())
        {
            if (!scope.ServiceProvider.GetRequiredService<IGeocodificador>().Habilitado)
            {
                _logger.LogInformation("Geocodificacao desligada: Geocoding:OpenRouteServiceApiKey nao configurada.");
                return;
            }
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var espera = EsperaSemPendentes;
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var geocodificador = scope.ServiceProvider.GetRequiredService<IGeocodificador>();
                var processados = await GeocodificacaoProcessor.ProcessarLoteAsync(
                    db, geocodificador, TamanhoDoLote, IntervaloEntreChamadas, stoppingToken);
                if (processados == TamanhoDoLote) espera = IntervaloEntreChamadas;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha na geocodificacao; nova tentativa em {Minutos} min.", EsperaAposFalha.TotalMinutes);
                espera = EsperaAposFalha;
            }

            try
            {
                await Task.Delay(espera, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
