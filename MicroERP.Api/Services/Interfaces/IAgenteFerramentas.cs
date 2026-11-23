using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Insights;

namespace MicroERP.Api.Services.Interfaces;

// Consultas do chat do Agente (KAN-77, fase 1). Criadas por pergunta, já presas
// à empresa do login (JWT): o modelo escolhe a consulta, nunca a empresa.
public interface IAgenteFerramentasFactory
{
    IAgenteFerramentas Criar(long empresaId);
}

public interface IAgenteFerramentas : IExecutorDeFerramentas
{
    // Rascunhos que o painel mostra junto da resposta (ex.: mensagem de WhatsApp).
    // Nada é enviado nem gravado: o Dono revisa e decide.
    IReadOnlyList<AcaoAgenteResponse> Acoes { get; }
}
