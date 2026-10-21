namespace MicroERP.Api.Services.Exceptions;

public sealed class UsuarioInativoException : Exception
{
    public UsuarioInativoException(string message) : base(message)
    {
    }
}

// Ação de gestão de usuários barrada por regra (ex.: o Dono se desativar).
public sealed class RegraUsuarioException : Exception
{
    public RegraUsuarioException(string message) : base(message)
    {
    }
}

public sealed class SenhaAtualInvalidaException : Exception
{
    public SenhaAtualInvalidaException(string message) : base(message)
    {
    }
}
