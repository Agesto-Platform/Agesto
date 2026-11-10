using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

// Área de superadmin: contas da equipe do Agesto.
public interface IAdminAuthService
{
    Task<AdminAuthResponse?> LoginAsync(AdminLoginRequest request, string? ip, CancellationToken cancellationToken);
    Task<AdminResponse> SetupAsync(AdminCriarRequest request, string? chave, string? ip, CancellationToken cancellationToken);
    Task<AdminResponse> ObterAsync(long adminId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AdminResponse>> ListarAsync(CancellationToken cancellationToken);
    Task<AdminResponse> CriarAsync(long adminId, AdminCriarRequest request, string? ip, CancellationToken cancellationToken);
    Task DefinirAtivoAsync(long adminId, long alvoId, bool ativo, string? ip, CancellationToken cancellationToken);
}

// Área de superadmin: gestão das empresas clientes. Toda alteração é auditada.
public interface IAdminEmpresaService
{
    Task<IReadOnlyList<EmpresaAdminResumo>> ListarAsync(string? busca, CancellationToken cancellationToken);
    Task<EmpresaAdminDetalhe> ObterAsync(long empresaId, CancellationToken cancellationToken);
    Task<EmpresaAdminCriadaResponse> CriarAsync(long adminId, EmpresaAdminCriarRequest request, string? ip, CancellationToken cancellationToken);
    Task BloquearAsync(long adminId, long empresaId, string motivo, string? ip, CancellationToken cancellationToken);
    Task DesbloquearAsync(long adminId, long empresaId, string? ip, CancellationToken cancellationToken);
    Task DefinirUsuarioAtivoAsync(long adminId, long empresaId, long usuarioId, bool ativo, string? ip, CancellationToken cancellationToken);
    Task<SenhaProvisoriaAdminResponse> RedefinirSenhaAsync(long adminId, long empresaId, long usuarioId, string? ip, CancellationToken cancellationToken);
    Task<IReadOnlyList<AuditoriaAdminItem>> ListarAuditoriaAsync(long? empresaId, CancellationToken cancellationToken);
}
