using MicroERP.Api.Enums;

namespace MicroERP.Api.Models;

public class Configuracao
{
    public long Id { get; set; }
    public TipoOperacao TipoOperacao { get; set; } = TipoOperacao.Hibrido;

    // Modo de agenda do agente no mobile (equipe vs solo) — ver DEC de parametrização.
    public ModoAgendaAgente ModoAgendaAgente { get; set; } = ModoAgendaAgente.Flexivel;

    // Se a empresa controla estoque: quando false, produtos viram catalogo de
    // materiais com preco/custo, sem baixa nem validacao de estoque.
    public bool ControlaEstoque { get; set; } = true;

    // Se o agente pode cadastrar serviço novo pelo app (vai para revisão do Dono).
    public bool AgenteCadastraServico { get; set; } = true;

    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

}
