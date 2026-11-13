namespace MicroERP.Api.Services.Exceptions;

// A empresa já usou as perguntas do dia ao Agente (DEC-21). Vira 429 no controller.
public sealed class LimiteIaExcedidoException(int limite)
    : Exception($"Sua empresa já fez as {limite} perguntas de hoje ao Agente. O limite recomeça amanhã.")
{
    public int Limite { get; } = limite;
}
