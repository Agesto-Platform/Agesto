using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IUsuarioService
{
    Task<bool> DeleteAsync(long usuarioId, long empresaId, CancellationToken cancellationToken);
    Task<IReadOnlyList<UsuarioResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    // Acesso novo com convite por email (DEC-55).
    Task<UsuarioConviteResponse> CreateAsync(long empresaId, UsuarioCreateRequest request, CancellationToken cancellationToken);
    Task<UsuarioConviteResponse> ReenviarConviteAsync(long empresaId, long id, CancellationToken cancellationToken);
    Task<UsuarioResponse> UpdateAsync(long empresaId, long donoId, long id, UsuarioUpdateRequest request, CancellationToken cancellationToken);
    Task<UsuarioResponse> SetAtivoAsync(long empresaId, long donoId, long id, bool ativo, CancellationToken cancellationToken);
}
