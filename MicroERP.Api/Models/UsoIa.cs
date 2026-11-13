namespace MicroERP.Api.Models;

// Consumo da IA por empresa e por dia (o "TenantUsage" da DEC-21). Uma linha por
// empresa e dia de Brasília: perguntas ao Agente, relatórios e tokens gastos.
// Não é dado operacional: não tem soft delete nem sai no sync.
public class UsoIa
{
    public long Id { get; set; }
    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Dia no horário de Brasília.</summary>
    public DateOnly Dia { get; set; }

    public int Perguntas { get; set; }
    public int Relatorios { get; set; }
    public long TokensEntrada { get; set; }
    public long TokensSaida { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
