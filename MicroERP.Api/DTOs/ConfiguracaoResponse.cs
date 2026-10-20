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
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}