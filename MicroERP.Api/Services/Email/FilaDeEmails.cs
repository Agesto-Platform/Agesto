using System.Threading.Channels;

namespace MicroERP.Api.Services.Email;

public interface IFilaDeEmails
{
    // false quando a fila está cheia: o email é descartado e a requisição não espera.
    bool Enfileirar(EmailMensagem mensagem);
}

// Fila em memória para o envio sair da requisição (DEC-54): a resposta do
// "Esqueci a senha" leva o mesmo tempo exista o email ou não, e uma lentidão do
// Brevo não segura o Dono na tela. O EnvioDeEmailWorker consome a fila.
public sealed class FilaDeEmails : IFilaDeEmails
{
    private readonly Channel<EmailMensagem> _canal = Channel.CreateBounded<EmailMensagem>(
        new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    public bool Enfileirar(EmailMensagem mensagem) => _canal.Writer.TryWrite(mensagem);

    public IAsyncEnumerable<EmailMensagem> LerTodos(CancellationToken cancellationToken) =>
        _canal.Reader.ReadAllAsync(cancellationToken);
}
