using System.Net;
using MicroERP.Api.Enums;

namespace MicroERP.Api.Services.Email;

// Emails dos chamados de suporte (DEC-60). Tudo o que vem do usuário vai escapado no HTML.
public static class EmailsDeSuporte
{
    public static string Rotulo(AssuntoTicket assunto) => assunto switch
    {
        AssuntoTicket.Duvida => "Dúvida",
        AssuntoTicket.Bug => "Problema (bug)",
        AssuntoTicket.Melhoria => "Sugestão de melhoria",
        AssuntoTicket.Assinatura => "Assinatura e pagamento",
        _ => "Outro assunto",
    };

    public static string Rotulo(StatusTicket status) => status switch
    {
        StatusTicket.Aberto => "Aberto",
        StatusTicket.EmAndamento => "Em andamento",
        _ => "Resolvido",
    };

    // Aviso para a equipe do Agesto, no email de suporte.
    public static EmailMensagem NovoParaEquipe(
        string paraEmail, long id, AssuntoTicket assunto, string mensagem,
        string empresa, string donoNome, string donoEmail, int anexos, string? urlWeb)
    {
        var link = $"{Base(urlWeb)}/admin/suporte";
        var linhaAnexos = TextoAnexos(anexos);
        var html = $"""
            <p>Novo chamado de suporte <b>#{id}</b> ({h(Rotulo(assunto))}).</p>
            <p>Empresa: {h(empresa)}<br>Dono: {h(donoNome)} &lt;{h(donoEmail)}&gt;</p>
            <blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 12px">{Paragrafos(mensagem)}</blockquote>
            {(linhaAnexos is null ? "" : $"<p>{h(linhaAnexos)}</p>")}
            <p>Responda e acompanhe na área de superadmin: <a href="{h(link)}">{h(link)}</a></p>
            """;
        var texto = $"""
            Novo chamado de suporte #{id} ({Rotulo(assunto)}).
            Empresa: {empresa}
            Dono: {donoNome} <{donoEmail}>

            {mensagem}
            {linhaAnexos}
            Responda e acompanhe na área de superadmin: {link}
            """;
        return new EmailMensagem(paraEmail, "Suporte Agesto", $"[Suporte #{id}] {Rotulo(assunto)} — {empresa}", html, texto);
    }

    // Cópia para o Dono que abriu o chamado.
    public static EmailMensagem CopiaParaDono(
        string email, string nome, long id, AssuntoTicket assunto, string mensagem, int anexos, string? urlWeb)
    {
        var link = $"{Base(urlWeb)}/suporte";
        var linhaAnexos = TextoAnexos(anexos);
        var html = $"""
            <p>Olá, {h(nome)}.</p>
            <p>Recebemos o seu chamado <b>#{id}</b> ({h(Rotulo(assunto))}). A equipe do Agesto vai responder pelo painel, e você recebe um email quando houver resposta.</p>
            <blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 12px">{Paragrafos(mensagem)}</blockquote>
            {(linhaAnexos is null ? "" : $"<p>{h(linhaAnexos)}</p>")}
            <p>Acompanhe o andamento na aba Suporte: <a href="{h(link)}">{h(link)}</a></p>
            """;
        var texto = $"""
            Olá, {nome}.

            Recebemos o seu chamado #{id} ({Rotulo(assunto)}). A equipe do Agesto vai responder pelo painel, e você recebe um email quando houver resposta.

            {mensagem}
            {linhaAnexos}
            Acompanhe o andamento na aba Suporte: {link}
            """;
        return new EmailMensagem(email, nome, $"Recebemos o seu chamado #{id}", html, texto);
    }

    // Aviso ao Dono de que a equipe respondeu.
    public static EmailMensagem RespostaParaDono(
        string email, string nome, long id, StatusTicket status, string resposta, string? urlWeb)
    {
        var link = $"{Base(urlWeb)}/suporte";
        var html = $"""
            <p>Olá, {h(nome)}.</p>
            <p>A equipe do Agesto respondeu o seu chamado <b>#{id}</b>. Situação: {h(Rotulo(status))}.</p>
            <blockquote style="border-left:3px solid #ccc;margin:0;padding:4px 12px">{Paragrafos(resposta)}</blockquote>
            <p>Veja o chamado completo na aba Suporte: <a href="{h(link)}">{h(link)}</a></p>
            """;
        var texto = $"""
            Olá, {nome}.

            A equipe do Agesto respondeu o seu chamado #{id}. Situação: {Rotulo(status)}.

            {resposta}

            Veja o chamado completo na aba Suporte: {link}
            """;
        return new EmailMensagem(email, nome, $"Resposta ao seu chamado #{id}", html, texto);
    }

    // Os arquivos não vão no email: ficam no chamado, por link temporário.
    private static string? TextoAnexos(int anexos) => anexos switch
    {
        0 => null,
        1 => "1 anexo no chamado.",
        _ => $"{anexos} anexos no chamado.",
    };

    private static string h(string texto) => WebUtility.HtmlEncode(texto);

    private static string Paragrafos(string texto) =>
        h(texto.Trim()).Replace("\r\n", "\n").Replace("\n", "<br>");

    private static string Base(string? urlWeb) => (urlWeb ?? string.Empty).TrimEnd('/');
}
