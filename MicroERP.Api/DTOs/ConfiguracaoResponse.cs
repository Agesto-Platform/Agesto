namespace MicroERP.Api.DTOs;
using MicroERP.Api.Enums;

public sealed class ConfiguracaoResponse
{
    public long Id { get; set; }
    public TipoOperacao TipoOperacao { get; set; }
    public ModoAgendaAgente ModoAgendaAgente { get; set; }
    public bool ControlaEstoque { get; set; }
    public bool AgenteCadastraServico { get; set; }
    public long EmpresaId { get; set; }
    // Cabeçalho do PDF do orçamento e nome na conta (DEC-56).
    public string? EmpresaNome { get; set; }
    public string? EmpresaDocumento { get; set; }
    // Quando a empresa entrou no Agesto: o começo do histórico da Agenda.
    public DateTime? EmpresaCriadaEm { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}