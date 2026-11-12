using MicroERP.Api.DTOs;
using MicroERP.Api.Models;

namespace MicroERP.Api.Services.Interfaces;

public interface IAuthService
{
    Task RegisterAsync(AuthRegisterRequest request, CancellationToken cancellationToken);
    Task<Usuario> CriarEmpresaComDonoAsync(string nomeEmpresa, string? documento, string nomeDono, string emailDono, string? senha, CancellationToken cancellationToken);
    Task<AuthResponse?> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken);
    Task TrocarSenhaAsync(long usuarioId, TrocarSenhaRequest request, CancellationToken cancellationToken);
    Task AceitarTermosAsync(long usuarioId, AceitarTermosRequest request, CancellationToken cancellationToken);
}
