using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;

namespace MicroERP.Api.Services.Interfaces;

// Chamados de suporte (DEC-60): o Dono abre e acompanha; a equipe responde e
// avança o status no superadmin.
public interface ISuporteService
{
    Task<TicketResponse> CriarAsync(long empresaId, long usuarioId, TicketCriarRequest request, IReadOnlyList<ArquivoRecebido> anexos, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketResponse>> ListarDaEmpresaAsync(long empresaId, CancellationToken cancellationToken);
    Task<TicketResponse> ObterDaEmpresaAsync(long empresaId, long id, CancellationToken cancellationToken);

    Task<IReadOnlyList<TicketResponse>> ListarAdminAsync(StatusTicket? status, CancellationToken cancellationToken);
    Task<TicketResponse> ObterAdminAsync(long id, CancellationToken cancellationToken);
    Task<TicketResponse> ResponderAsync(long adminId, long id, TicketResponderRequest request, string? ip, CancellationToken cancellationToken);
    Task<TicketResponse> MudarStatusAsync(long adminId, long id, StatusTicket status, string? ip, CancellationToken cancellationToken);
}
