using System.Net;
using MicroERP.Api.Enums;
using MicroERP.Api.Services;

namespace MicroERP.Api.Services.Email;

// Textos dos emails de senha (DEC-54 e DEC-55). O nome vai escapado no HTML.
public static class EmailsDeSenha
{
    public static EmailMensagem Redefinicao(string email, string nome, string link) =>
        Montar(email, nome, "Redefinir a sua senha do Agesto",
            "Recebemos um pedido para redefinir a senha do seu acesso ao Agesto.",
            "Criar uma senha nova", link, LinksDeSenha.ValidadeRedefinicao,
            "Se não foi você, ignore este email: a sua senha continua a mesma.");

    // Acesso novo a uma empresa, criado pela equipe do Agesto.
    public static EmailMensagem ConviteUsuario(
        string email, string nome, string empresa, PerfilUsuario perfil, string link, string? urlWeb)
    {
        var depois = perfil == PerfilUsuario.Agente
            ? $"Depois, entre pelo app do Agesto. Se ainda não tem o app, baixe em {Base(urlWeb)}/baixar."
            : $"Depois, entre no painel em {Base(urlWeb)}/login.";
        return Montar(email, nome, $"Seu acesso ao Agesto ({empresa})",
            $"A equipe do Agesto criou o seu acesso à empresa {empresa}. Para começar, crie a sua senha.",
            "Criar a minha senha", link, LinksDeSenha.ValidadeConvite, depois);
    }

    // Link de senha enviado pela equipe do Agesto para quem já tem acesso.
    public static EmailMensagem LinkPelaEquipe(string email, string nome, string link) =>
        Montar(email, nome, "Crie uma senha nova para o Agesto",
            "A equipe do Agesto enviou um link para você criar uma senha nova.",
            "Criar uma senha nova", link, LinksDeSenha.ValidadeConvite,
            "Se você não pediu isso, fale com o suporte do Agesto.");

    public static EmailMensagem ConviteAdmin(string email, string nome, string link) =>
        Montar(email, nome, "Convite para a equipe do Agesto",
            "Você foi convidado para a área de administração do Agesto. Para entrar, crie a sua senha.",
            "Criar a minha senha", link, LinksDeSenha.ValidadeConvite,
            "Se não esperava este convite, ignore este email.");

    // Código da verificação em duas etapas do superadmin (DEC-52).
    public static EmailMensagem CodigoAdmin(string email, string nome, string codigo)
    {
        static string h(string texto) => WebUtility.HtmlEncode(texto);
        var html = $"""
            <p>Olá, {h(nome)}.</p>
            <p>Seu código para entrar na área de administração do Agesto:</p>
            <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{h(codigo)}</p>
            <p>O código vale por 10 minutos e funciona uma vez só.</p>
            <p>Se não foi você que tentou entrar, troque a sua senha e avise a equipe.</p>
            """;
        var texto = $"""
            Olá, {nome}.

            Seu código para entrar na área de administração do Agesto: {codigo}

            O código vale por 10 minutos e funciona uma vez só.
            Se não foi você que tentou entrar, troque a sua senha e avise a equipe.
            """;
        return new EmailMensagem(email, nome, $"Código de acesso do Agesto: {codigo}", html, texto);
    }

    private static string Base(string? urlWeb) => (urlWeb ?? string.Empty).TrimEnd('/');

    private static EmailMensagem Montar(
        string email, string nome, string assunto, string intro, string acao, string link, TimeSpan validade, string fecho)
    {
        var prazo = validade.TotalHours >= 1 ? $"{(int)validade.TotalHours} horas" : $"{(int)validade.TotalMinutes} minutos";
        static string h(string texto) => WebUtility.HtmlEncode(texto);
        var html = $"""
            <p>Olá, {h(nome)}.</p>
            <p>{h(intro)}</p>
            <p><a href="{h(link)}">{h(acao)}</a></p>
            <p>O link vale por {prazo} e funciona uma vez só.</p>
            <p>{h(fecho)}</p>
            """;
        var texto = $"""
            Olá, {nome}.

            {intro}
            {acao}: {link}

            O link vale por {prazo} e funciona uma vez só.
            {fecho}
            """;
        return new EmailMensagem(email, nome, assunto, html, texto);
    }
}
