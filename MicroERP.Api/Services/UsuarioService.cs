using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class UsuarioService : IUsuarioService
{
    // Sem caracteres que se confundem ao ditar ou ler (0/O, 1/l/I).
    private const string AlfabetoSenha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private const int TamanhoSenhaProvisoria = 10;

    private readonly IUsuarioRepository _usuarioRepository;
    private readonly PasswordHasher<Usuario> _passwordHasher = new();

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

    public async Task<IReadOnlyList<UsuarioResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var usuarios = await _usuarioRepository.GetAllAsync(empresaId, cancellationToken);
        return usuarios.Select(MapResponse).ToList();
    }

    public async Task<UsuarioSenhaProvisoriaResponse> CreateAsync(long empresaId, UsuarioCreateRequest request, CancellationToken cancellationToken)
    {
        ValidarPerfil(request.Perfil);

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _usuarioRepository.EmailExistsAsync(email, cancellationToken))
        {
            throw new EmailAlreadyExistsException("Email ja cadastrado.");
        }

        var senha = GerarSenhaProvisoria();
        var usuario = new Usuario
        {
            Nome = request.Nome.Trim(),
            Email = email,
            EmpresaId = empresaId,
            Perfil = request.Perfil,
            Ativo = true,
            DeveTrocarSenha = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        usuario.Senha = _passwordHasher.HashPassword(usuario, senha);

        await _usuarioRepository.AddAsync(usuario, cancellationToken);
        await _usuarioRepository.SaveChangesAsync(cancellationToken);

        return new UsuarioSenhaProvisoriaResponse { Usuario = MapResponse(usuario), SenhaProvisoria = senha };
    }

    public async Task<UsuarioResponse> UpdateAsync(long empresaId, long donoId, long id, UsuarioUpdateRequest request, CancellationToken cancellationToken)
    {
        ValidarPerfil(request.Perfil);

        var usuario = await ObterAsync(empresaId, id, cancellationToken);

        if (usuario.Perfil == PerfilUsuario.Dono && request.Perfil != PerfilUsuario.Dono)
        {
            if (usuario.Id == donoId)
                throw new RegraUsuarioException("Voce nao pode remover o seu proprio perfil de Dono.");
            if (usuario.Ativo && await _usuarioRepository.CountDonosAtivos(empresaId, cancellationToken) <= 1)
                throw new RegraUsuarioException("A empresa precisa de pelo menos um Dono ativo.");
        }

        usuario.Nome = request.Nome.Trim();
        usuario.Perfil = request.Perfil;
        usuario.UpdatedAt = DateTime.UtcNow;

        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        return MapResponse(usuario);
    }

    public async Task<UsuarioResponse> SetAtivoAsync(long empresaId, long donoId, long id, bool ativo, CancellationToken cancellationToken)
    {
        var usuario = await ObterAsync(empresaId, id, cancellationToken);

        if (!ativo)
        {
            if (usuario.Id == donoId)
                throw new RegraUsuarioException("Voce nao pode desativar o seu proprio acesso.");
            if (usuario.Perfil == PerfilUsuario.Dono && usuario.Ativo
                && await _usuarioRepository.CountDonosAtivos(empresaId, cancellationToken) <= 1)
                throw new RegraUsuarioException("A empresa precisa de pelo menos um Dono ativo.");
        }

        usuario.Ativo = ativo;
        usuario.UpdatedAt = DateTime.UtcNow;

        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        return MapResponse(usuario);
    }

    public async Task<UsuarioSenhaProvisoriaResponse> RedefinirSenhaAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var usuario = await ObterAsync(empresaId, id, cancellationToken);

        var senha = GerarSenhaProvisoria();
        usuario.Senha = _passwordHasher.HashPassword(usuario, senha);
        usuario.DeveTrocarSenha = true;
        usuario.UpdatedAt = DateTime.UtcNow;

        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        return new UsuarioSenhaProvisoriaResponse { Usuario = MapResponse(usuario), SenhaProvisoria = senha };
    }

    private async Task<Usuario> ObterAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var usuario = await _usuarioRepository.GetByIdAsync(empresaId, id, cancellationToken);
        return usuario ?? throw new NotFoundException("Usuario nao encontrado.");
    }

    private static void ValidarPerfil(PerfilUsuario perfil)
    {
        if (perfil is not (PerfilUsuario.Dono or PerfilUsuario.Agente))
            throw new ArgumentException("Perfil invalido.");
    }

    private static string GerarSenhaProvisoria()
        => RandomNumberGenerator.GetString(AlfabetoSenha, TamanhoSenhaProvisoria);

    private static UsuarioResponse MapResponse(Usuario usuario) => new()
    {
        Id = usuario.Id,
        Nome = usuario.Nome,
        Email = usuario.Email,
        Perfil = usuario.Perfil,
        Ativo = usuario.Ativo,
        DeveTrocarSenha = usuario.DeveTrocarSenha,
        UltimoAcessoEm = usuario.UltimoAcessoEm,
        CreatedAt = usuario.CreatedAt
    };
}
