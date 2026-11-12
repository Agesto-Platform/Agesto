using MicroERP.Api.Models;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Tests.Services;

// Registra os convites em vez de mandar email (DEC-55).
public sealed class ConvitesFalsos : IConviteService
{
    public List<Usuario> Usuarios { get; } = [];
    public List<AdminPlataforma> Admins { get; } = [];
    public bool EnvioHabilitado => true;

    public Task EnviarParaUsuarioAsync(Usuario usuario, CancellationToken cancellationToken)
    {
        Usuarios.Add(usuario);
        return Task.CompletedTask;
    }

    public Task EnviarParaAdminAsync(AdminPlataforma admin, CancellationToken cancellationToken)
    {
        Admins.Add(admin);
        return Task.CompletedTask;
    }
}
