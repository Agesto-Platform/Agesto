namespace MicroERP.Api.Services.Exceptions;

// Setup do primeiro admin recusado. StatusCode diz ao controller como responder:
// 404 (setup desligado), 401 (chave errada) ou 409 (já existe admin).
public sealed class AdminSetupException : Exception
{
    public int StatusCode { get; }

    public AdminSetupException(int statusCode, string message) : base(message)
    {
        StatusCode = statusCode;
    }
}
