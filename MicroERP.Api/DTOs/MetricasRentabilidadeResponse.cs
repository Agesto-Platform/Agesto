namespace MicroERP.Api.DTOs;

// Resumo de rentabilidade do periodo (atendimentos Concluidos): alimenta os KPIs
// do painel Web do dono (faturamento, margem, ticket medio). Margem = faturamento
// - custo (custo vem dos itens de produto, DEC-19/KAN-73).
public sealed class MetricasRentabilidadeResponse
{
    public decimal Faturamento { get; set; }
    public decimal CustoTotal { get; set; }
    public decimal Margem { get; set; }
    public decimal MargemPercentual { get; set; }
    public int Atendimentos { get; set; }
    public decimal TicketMedio { get; set; }
    // Faturamento de cada dia em Brasília, com os mesmos atendimentos do total (J-02).
    public IReadOnlyList<ReceitaDiaPonto> ReceitaPorDia { get; set; } = [];
}

// Dia no calendário de Brasília ("2026-11-17"), sem hora nem fuso, para o web não deslocar.
public sealed class ReceitaDiaPonto
{
    public DateOnly Dia { get; set; }
    public decimal Valor { get; set; }
}
