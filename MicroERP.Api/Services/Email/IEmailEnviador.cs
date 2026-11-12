namespace MicroERP.Api.Services.Email;

public sealed record EmailMensagem(string ParaEmail, string ParaNome, string Assunto, string Html, string Texto);

// Envia email transacional. Atrás de interface para trocar de provedor sem mexer
// no resto (hoje o Brevo, DEC-54).
public interface IEmailEnviador
{
    // false quando não há chave configurada: o envio fica desligado.
    bool Habilitado { get; }

    // Falha de rede ou recusa do provedor lança exceção.
    Task EnviarAsync(EmailMensagem mensagem, CancellationToken cancellationToken);
}
