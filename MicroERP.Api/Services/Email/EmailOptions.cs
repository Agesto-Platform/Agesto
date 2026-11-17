namespace MicroERP.Api.Services.Email;

// Seção "Email" da configuração (DEC-54). No Render: Email__BrevoApiKey,
// Email__RemetenteEmail, Email__RemetenteNome e Email__UrlWeb.
// Sem a chave do Brevo o envio fica desligado e nada quebra.
public sealed class EmailOptions
{
    public const string Secao = "Email";

    public string? BrevoApiKey { get; set; }
    public string BrevoUrl { get; set; } = "https://api.brevo.com";

    // Remetente verificado no Brevo (Senders, domains & dedicated IPs).
    public string? RemetenteEmail { get; set; }
    public string RemetenteNome { get; set; } = "Agesto";

    // Endereço do web, base dos links enviados por email (ex.: https://agesto.pages.dev).
    public string? UrlWeb { get; set; }

    // Caixa da equipe do Agesto que recebe os chamados da aba Suporte (DEC-60).
    // Vazio: o chamado fica no superadmin e só a cópia do Dono sai.
    public string? SuporteEmail { get; set; }

    public bool EnvioHabilitado =>
        !string.IsNullOrWhiteSpace(BrevoApiKey) && !string.IsNullOrWhiteSpace(RemetenteEmail);
}
