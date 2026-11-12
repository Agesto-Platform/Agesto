using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using MicroERP.Api.Services.Email;

namespace MicroERP.Tests.Services;

// Envio pelo Brevo (DEC-54), sem rede: o handler falso guarda a requisição.
public sealed class BrevoEmailEnviadorTests
{
    private sealed class HandlerFalso(HttpStatusCode status) : HttpMessageHandler
    {
        public HttpRequestMessage? Requisicao { get; private set; }
        public string? Corpo { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requisicao = request;
            Corpo = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent("{\"message\":\"erro\"}") };
        }
    }

    private static readonly EmailMensagem Mensagem =
        new("dono@teste.com", "Dono", "Assunto", "<p>Oi</p>", "Oi");

    private static BrevoEmailEnviador Enviador(HandlerFalso handler, string? chave = "chave-teste", string? remetente = "nao-responda@agesto.exemplo") =>
        new(new HttpClient(handler), Options.Create(new EmailOptions
        {
            BrevoApiKey = chave,
            RemetenteEmail = remetente,
            RemetenteNome = "Agesto",
        }));

    [Fact]
    public async Task Envia_ParaOEndpointDoBrevo_ComAChaveNoCabecalho()
    {
        var handler = new HandlerFalso(HttpStatusCode.Created);

        await Enviador(handler).EnviarAsync(Mensagem, CancellationToken.None);

        Assert.Equal(HttpMethod.Post, handler.Requisicao!.Method);
        Assert.Equal("https://api.brevo.com/v3/smtp/email", handler.Requisicao.RequestUri!.ToString());
        Assert.Equal("chave-teste", handler.Requisicao.Headers.GetValues("api-key").Single());
        using var json = JsonDocument.Parse(handler.Corpo!);
        var raiz = json.RootElement;
        Assert.Equal("nao-responda@agesto.exemplo", raiz.GetProperty("sender").GetProperty("email").GetString());
        Assert.Equal("dono@teste.com", raiz.GetProperty("to")[0].GetProperty("email").GetString());
        Assert.Equal("Assunto", raiz.GetProperty("subject").GetString());
        Assert.Equal("<p>Oi</p>", raiz.GetProperty("htmlContent").GetString());
        Assert.Equal("Oi", raiz.GetProperty("textContent").GetString());
    }

    [Theory]
    [InlineData(null, "nao-responda@agesto.exemplo")]
    [InlineData("chave-teste", null)]
    public async Task SemChaveOuRemetente_FicaDesligadoENaoChamaORede(string? chave, string? remetente)
    {
        var handler = new HandlerFalso(HttpStatusCode.Created);
        var enviador = Enviador(handler, chave, remetente);

        await enviador.EnviarAsync(Mensagem, CancellationToken.None);

        Assert.False(enviador.Habilitado);
        Assert.Null(handler.Requisicao);
    }

    [Fact]
    public async Task BrevoRecusa_LancaErro()
    {
        var handler = new HandlerFalso(HttpStatusCode.Unauthorized);

        var erro = await Assert.ThrowsAsync<HttpRequestException>(() => Enviador(handler).EnviarAsync(Mensagem, CancellationToken.None));
        Assert.Contains("401", erro.Message);
    }
}
