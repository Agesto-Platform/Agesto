namespace MicroERP.Api.DTOs;

// Perguntas ao Agente usadas hoje pela empresa (DEC-21).
public sealed class UsoIaResponse
{
    public int Limite { get; set; }
    public int Usadas { get; set; }
    public int Restantes { get; set; }
}
