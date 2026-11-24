using Microsoft.Net.Http.Headers;

namespace MicroERP.Api.Authorization;

// Cookie httpOnly com o token do web (KAN-33, DEC-53): preparado e desligado.
// Enquanto web (Cloudflare Pages) e API (Render) estiverem em sites diferentes, o
// Safari e o iPhone bloqueiam esse cookie, então ele só deve ser ligado com o
// domínio próprio (KAN-16), web e API no mesmo site. Ligado (Auth:CookieSessao=true):
// - o login e a troca de senha gravam o cookie, além de devolver o token no corpo;
// - a API aceita o token do cookie quando a requisição não traz Authorization (o app
//   e o web atual seguem com Bearer);
// - em método que altera dados, o cookie só vale com o cabeçalho X-Agesto-Csrf: 1.
//   Cabeçalho próprio obriga o navegador a passar pelo CORS, que só libera as origens
//   do Agesto; um formulário de outro site não consegue mandá-lo (proteção contra CSRF).
public static class CookieDeSessao
{
    public const string Nome = "agesto_sessao";
    public const string CabecalhoCsrf = "X-Agesto-Csrf";

    public static bool Ligado(IConfiguration configuration) =>
        configuration.GetValue("Auth:CookieSessao", false);

    // Token vindo do cookie, ou nulo quando o cookie não deve ser usado nesta requisição.
    public static string? TokenDaRequisicao(HttpRequest request, IConfiguration configuration)
    {
        if (!Ligado(configuration) || request.Headers.ContainsKey(HeaderNames.Authorization))
            return null;
        if (!request.Cookies.TryGetValue(Nome, out var token) || string.IsNullOrWhiteSpace(token))
            return null;

        var leitura = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method);
        if (!leitura && request.Headers[CabecalhoCsrf] != "1")
            return null;
        return token;
    }

    public static void Gravar(HttpResponse response, IConfiguration configuration, string token, DateTime expiraEm)
    {
        if (Ligado(configuration))
            response.Cookies.Append(Nome, token, Opcoes(configuration, expiraEm));
    }

    public static void Apagar(HttpResponse response, IConfiguration configuration)
    {
        if (Ligado(configuration))
            response.Cookies.Delete(Nome, Opcoes(configuration, null));
    }

    // SameSite=Lax: com web e API no mesmo site, o cookie vai nas chamadas do painel e
    // não vai em navegação ou formulário vindos de outro site. Path=/api: só a API o lê.
    private static CookieOptions Opcoes(IConfiguration configuration, DateTime? expiraEm)
    {
        var dominio = configuration["Auth:CookieDominio"];
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Lax,
            Path = "/api",
            Domain = string.IsNullOrWhiteSpace(dominio) ? null : dominio.Trim(),
            Expires = expiraEm is null ? null : new DateTimeOffset(DateTime.SpecifyKind(expiraEm.Value, DateTimeKind.Utc)),
            IsEssential = true,
        };
    }
}
