namespace MicroERP.Api.Services.Exceptions;

// Token de "Esqueci a senha" inexistente, vencido ou já usado (DEC-54). A mensagem
// é a mesma nos três casos, para não dizer qual foi.
public sealed class TokenRedefinicaoInvalidoException : Exception
{
    public TokenRedefinicaoInvalidoException()
        : base("Link inválido ou expirado. Peça um novo em \"Esqueci a senha\".")
    {
    }
}
