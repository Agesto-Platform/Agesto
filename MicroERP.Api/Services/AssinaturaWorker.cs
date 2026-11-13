using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Rotina do bloqueio automático por atraso (DEC-58): roda pouco depois de a API
// subir e depois de hora em hora. É idempotente, então rodar a mais não faz mal.
public sealed class AssinaturaWorker : BackgroundService
{
    private static readonly TimeSpan Intervalo = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _escopos;
    private readonly ILogger<AssinaturaWorker> _logger;

    public AssinaturaWorker(IServiceScopeFactory escopos, ILogger<AssinaturaWorker> logger)
    {
        _escopos = escopos;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            using var timer = new PeriodicTimer(Intervalo);
            do
            {
                await RodarAsync(stoppingToken);
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // API desligando.
        }
    }

    private async Task RodarAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var escopo = _escopos.CreateScope();
            var assinaturas = escopo.ServiceProvider.GetRequiredService<IAssinaturaService>();
            var bloqueadas = await assinaturas.BloquearAtrasadasAsync(cancellationToken);
            if (bloqueadas > 0)
                _logger.LogInformation("Bloqueio automático por atraso: {Quantidade} empresa(s).", bloqueadas);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Falha na rotina de bloqueio automático por atraso.");
        }
    }
}
