namespace MicroERP.Api.DTOs;

public sealed class MetricasServicosResponse
{
    public decimal ReceitaTotal { get; set; }
    public IReadOnlyList<ServicoReceitaItem> ReceitaPorServico { get; set; } = Array.Empty<ServicoReceitaItem>();
}

public sealed class ServicoReceitaItem
{
    public long ServicoId { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public string TipoCobranca { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public decimal Receita { get; set; }
    // Horas no período (por hora: a quantidade; por empreitada: execuções x duração estimada).
    // Nulo quando o serviço por empreitada não tem duração cadastrada.
    public decimal? Horas { get; set; }
    public decimal? ReceitaPorHora { get; set; }
}
