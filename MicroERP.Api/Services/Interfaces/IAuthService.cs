using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IAuthService
{
    Task RegisterAsync(AuthRegisterRequest request, CancellationToken cancellationToken);
    Task<AuthResponse?> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken);
    Task TrocarSenhaAsync(long usuarioId, TrocarSenhaRequest request, CancellationToken cancellationToken);
}
