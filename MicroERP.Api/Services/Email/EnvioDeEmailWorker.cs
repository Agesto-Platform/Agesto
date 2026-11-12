namespace MicroERP.Api.Services.Email;

// Envia em segundo plano os emails da FilaDeEmails (DEC-54). Uma falha só é
// registrada no log, sem o destinatário nem o conteúdo (o link tem o token).
public sealed class EnvioDeEmailWorker : BackgroundService
{
    private readonly FilaDeEmails _fila;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EnvioDeEmailWorker> _logger;

    public EnvioDeEmailWorker(FilaDeEmails fila, IServiceScopeFactory scopeFactory, ILogger<EnvioDeEmailWorker> logger)
    {
        _fila = fila;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var mensagem in _fila.LerTodos(stoppingToken))
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var enviador = scope.ServiceProvider.GetRequiredService<IEmailEnviador>();
                    if (!enviador.Habilitado)
                    {
                        _logger.LogWarning("Envio de email desligado: configure Email:BrevoApiKey e Email:RemetenteEmail.");
                        continue;
                    }
                    await enviador.EnviarAsync(mensagem, stoppingToken);
                    _logger.LogInformation("Email enviado: {Assunto}.", mensagem.Assunto);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Falha ao enviar email: {Assunto}.", mensagem.Assunto);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // desligando a API
        }
    }
}
