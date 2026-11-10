namespace MicroERP.Api.DTOs;

// Interpretação das métricas do período pela IA, em quatro blocos (DEC-20).
public sealed class InsightsResponse
{
    public DateTime De { get; set; }
    public DateTime Ate { get; set; }
    public string Resumo { get; set; } = string.Empty;
    public IReadOnlyList<string> Destaques { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> Alertas { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> Recomendacoes { get; set; } = Array.Empty<string>();
    public string Modelo { get; set; } = string.Empty;
    public DateTime GeradoEm { get; set; }
}
