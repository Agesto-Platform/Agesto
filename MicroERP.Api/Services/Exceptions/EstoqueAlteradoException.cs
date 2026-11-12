namespace MicroERP.Api.Services.Exceptions;

// Outra gravação mexeu no estoque do produto entre a leitura e o salvamento
// (vendas simultâneas). Nada foi gravado; repetir a operação resolve.
public sealed class EstoqueAlteradoException : Exception
{
    public const string Mensagem = "O estoque deste produto mudou enquanto você salvava. Confira e tente de novo.";

    public EstoqueAlteradoException(Exception inner) : base(Mensagem, inner)
    {
    }
}
