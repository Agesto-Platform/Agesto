using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace MicroERP.Api.Services.Email;

// Email transacional pelo Brevo: POST /v3/smtp/email (DEC-54).
public sealed class BrevoEmailEnviador : IEmailEnviador
{
    private readonly HttpClient _http;
    private readonly EmailOptions _options;

    public BrevoEmailEnviador(HttpClient http, IOptions<EmailOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool Habilitado =>
        !string.IsNullOrWhiteSpace(_options.BrevoApiKey) && !string.IsNullOrWhiteSpace(_options.RemetenteEmail);

    public async Task EnviarAsync(EmailMensagem mensagem, CancellationToken cancellationToken)
    {
        if (!Habilitado) return;

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BrevoUrl.TrimEnd('/')}/v3/smtp/email")
        {
            Content = JsonContent.Create(new
            {
                sender = new { name = _options.RemetenteNome, email = _options.RemetenteEmail },
                to = new[] { new { email = mensagem.ParaEmail, name = mensagem.ParaNome } },
                subject = mensagem.Assunto,
                htmlContent = mensagem.Html,
                textContent = mensagem.Texto,
            }),
        };
        // Chave no cabeçalho, nunca na URL, para não aparecer em logs.
        request.Headers.TryAddWithoutValidation("api-key", _options.BrevoApiKey);
        request.Headers.TryAddWithoutValidation("accept", "application/json");

        using var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            // O corpo do erro do Brevo não traz o destinatário nem o conteúdo.
            var corpo = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"Brevo respondeu {(int)response.StatusCode}: {corpo[..Math.Min(corpo.Length, 300)]}");
        }
    }
}
