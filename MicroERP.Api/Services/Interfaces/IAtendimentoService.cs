using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IAtendimentoService
{
    Task<PaginaResponse<AtendimentoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, AtendimentoFiltroQuery? filtro, CancellationToken cancellationToken);
    Task<AtendimentoContagemResponse> ContarPorStatusAsync(long empresaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AgendaItemResponse>> GetAgendaAsync(long empresaId, DateTime? de, DateTime? ate, long? agenteId, CancellationToken cancellationToken);
    Task<AtendimentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<AtendimentoResponse> CreateAsync(long empresaId, long usuarioId, AtendimentoCreateRequest request, CancellationToken cancellationToken);
    Task<AtendimentoResponse> UpdateAsync(long empresaId, long id, AtendimentoUpdateRequest request, CancellationToken cancellationToken);
    // Cobrança mínima: data e forma do pagamento, ou null para voltar para "a receber".
    Task<AtendimentoResponse> RegistrarRecebimentoAsync(long empresaId, long id, AtendimentoRecebimentoRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken);
}
