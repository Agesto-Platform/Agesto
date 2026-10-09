using MicroERP.Api.Enums;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class UsuarioService : IUsuarioService
{
    private readonly IUsuarioRepository _usuarioRepository;

    public UsuarioService(IUsuarioRepository usuarioRepository)
    {
        _usuarioRepository = usuarioRepository;
    }

    public async Task<bool> DeleteAsync(long usuarioId, long empresaId, CancellationToken cancellationToken)
    {
        var usuario = await _usuarioRepository.GetByIdAsync(usuarioId, cancellationToken);
        if (usuario is null)
        {
            return false;
        }

        if (usuario.Perfil == PerfilUsuario.Dono)
        {
            var totalDonos = await _usuarioRepository.CountDonos(empresaId, cancellationToken);
            if (totalDonos <= 1)
            {
                throw new UltimoDonoDaEmpresaException("Não é possível remover o último Dono da empresa. Delete a empresa ou transfira a responsabilidade primeiro.");
            }
        }

        await _usuarioRepository.DeleteAsync(usuario, cancellationToken);
        await _usuarioRepository.SaveChangesAsync(cancellationToken);

        return true;
    }
}