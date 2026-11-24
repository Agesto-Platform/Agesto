using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using MicroERP.Api.Authorization;

namespace MicroERP.Tests.Authorization;

// Cookie httpOnly do web (KAN-33): desligado por padrão; ligado, vale só sem
// Authorization e, em método que altera dados, com o cabeçalho anti-CSRF.
public sealed class CookieDeSessaoTests
{
    [Fact]
    public void Desligado_NaoLeNemGravaCookie()
    {
        var config = Config(ligado: false);
        var request = Requisicao("POST", cookie: "tok", csrf: true);

        Assert.Null(CookieDeSessao.TokenDaRequisicao(request, config));

        var resposta = new DefaultHttpContext().Response;
        CookieDeSessao.Gravar(resposta, config, "tok", DateTime.UtcNow.AddDays(1));
        Assert.False(resposta.Headers.ContainsKey("Set-Cookie"));
    }

    [Fact]
    public void Ligado_LeituraUsaOCookie_EscritaPedeOCabecalhoAntiCsrf()
    {
        var config = Config(ligado: true);

        Assert.Equal("tok", CookieDeSessao.TokenDaRequisicao(Requisicao("GET", cookie: "tok"), config));
        Assert.Null(CookieDeSessao.TokenDaRequisicao(Requisicao("POST", cookie: "tok"), config));
        Assert.Equal("tok", CookieDeSessao.TokenDaRequisicao(Requisicao("POST", cookie: "tok", csrf: true), config));
        Assert.Null(CookieDeSessao.TokenDaRequisicao(Requisicao("GET"), config));
    }

    [Fact]
    public void Ligado_AuthorizationTemPreferencia()
    {
        var request = Requisicao("GET", cookie: "tok");
        request.Headers.Authorization = "Bearer outro";

        Assert.Null(CookieDeSessao.TokenDaRequisicao(request, Config(ligado: true)));
    }

    [Fact]
    public void Ligado_GravaCookieHttpOnlySeguroLaxNaApi()
    {
        var resposta = new DefaultHttpContext().Response;

        CookieDeSessao.Gravar(resposta, Config(ligado: true, dominio: "agesto.com.br"), "tok", DateTime.UtcNow.AddDays(30));

        var cookie = resposta.Headers.SetCookie.ToString().ToLowerInvariant();
        Assert.Contains("agesto_sessao=tok", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("path=/api", cookie);
        Assert.Contains("domain=agesto.com.br", cookie);
    }

    private static HttpRequest Requisicao(string metodo, string? cookie = null, bool csrf = false)
    {
        var contexto = new DefaultHttpContext();
        contexto.Request.Method = metodo;
        if (cookie is not null)
            contexto.Request.Headers.Cookie = $"{CookieDeSessao.Nome}={cookie}";
        if (csrf)
            contexto.Request.Headers[CookieDeSessao.CabecalhoCsrf] = "1";
        return contexto.Request;
    }

    private static IConfiguration Config(bool ligado, string? dominio = null) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:CookieSessao"] = ligado ? "true" : "false",
                ["Auth:CookieDominio"] = dominio,
            })
            .Build();
}
