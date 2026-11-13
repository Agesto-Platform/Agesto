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
    private readonly IUsuarioRepository _usuarioRepository;
    private readonly IConviteService _convites;
    private readonly IAssinaturaService _assinaturas;
    private readonly PasswordHasher<Usuario> _passwordHasher = new();

    public UsuarioService(IUsuarioRepository usuarioRepository, IConviteService convites, IAssinaturaService assinaturas)
    {
        _usuarioRepository = usuarioRepository;
        _convites = convites;
        _assinaturas = assinaturas;
    }

    public async Task<bool> DeleteAsync(long usuarioId, long empresaId, CancellationToken cancellationToken)
    {
        var usuario = await _usuarioRepository.GetByIdAsync(empresaId, usuarioId, cancellationToken);
        if (usuario is null)
        {
            return false;
        }

        // mesma regra da desativação (DEC-35): a empresa não fica sem Dono ativo
        if (usuario.Perfil == PerfilUsuario.Dono && usuario.Ativo
            && await _usuarioRepository.CountDonosAtivos(empresaId, cancellationToken) <= 1)
        {
            throw new UltimoDonoDaEmpresaException("Não é possível remover o último Dono da empresa. Delete a empresa ou transfira a responsabilidade primeiro.");
        }

        // Soft delete com anonimização: atendimentos e orçamentos continuam apontando
        // para a linha, mas nada nela identifica a pessoa e ela não entra mais.
        DadosPessoais.Anonimizar(usuario);
        usuario.Senha = _passwordHasher.HashPassword(usuario, Guid.NewGuid().ToString());
        usuario.DeletedAt = DateTime.UtcNow;
        usuario.UpdatedAt = usuario.DeletedAt.Value;
        await _usuarioRepository.SaveChangesAsync(cancellationToken);

        return true;
    }

    public async Task<IReadOnlyList<UsuarioResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var usuarios = await _usuarioRepository.GetAllAsync(empresaId, cancellationToken);
        return usuarios.Select(MapResponse).ToList();
    }

    // O Dono cria o acesso de um funcionário; a pessoa recebe o convite por email e
    // cria a própria senha pelo link (DEC-55). Não há mais senha provisória.
    public async Task<UsuarioConviteResponse> CreateAsync(long empresaId, UsuarioCreateRequest request, CancellationToken cancellationToken)
    {
        ValidarPerfil(request.Perfil);

        var email = AuthService.NormalizeEmail(request.Email);
        if (await _usuarioRepository.EmailExistsAsync(email, cancellationToken))
        {
            throw new EmailAlreadyExistsException("Email já cadastrado.");
        }
        // Licenças da assinatura (DEC-58): não passa do contratado.
        await _assinaturas.GarantirLicencaAsync(empresaId, cancellationToken);

        var agora = DateTime.UtcNow;
        var usuario = new Usuario
        {
            Nome = request.Nome.Trim(),
            Email = email,
            EmpresaId = empresaId,
            Perfil = request.Perfil,
            Ativo = true,
            CreatedAt = agora,
            UpdatedAt = agora
        };
        // Até o convite ser usado, a senha é um valor aleatório que ninguém conhece.
        usuario.Senha = _passwordHasher.HashPassword(usuario, AuthService.SenhaDesconhecida());

        await _usuarioRepository.AddAsync(usuario, cancellationToken);
        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);

        return new UsuarioConviteResponse { Usuario = MapResponse(usuario), EnvioHabilitado = _convites.EnvioHabilitado };
    }

    // Reenvia o convite a quem ainda não criou a senha (o link anterior deixa de valer).
    public async Task<UsuarioConviteResponse> ReenviarConviteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var usuario = await ObterAsync(empresaId, id, cancellationToken);
        if (usuario.EmailConfirmadoEm is not null)
            throw new RegraUsuarioException("Esta pessoa já criou a senha. Se esqueceu, ela pode usar \"Esqueci a senha\".");
        if (!usuario.Ativo)
            throw new RegraUsuarioException("Reative o acesso antes de reenviar o convite.");

        await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);
        return new UsuarioConviteResponse { Usuario = MapResponse(usuario), EnvioHabilitado = _convites.EnvioHabilitado };
    }

    public async Task<UsuarioResponse> UpdateAsync(long empresaId, long donoId, long id, UsuarioUpdateRequest request, CancellationToken cancellationToken)
    {
        ValidarPerfil(request.Perfil);

        var usuario = await ObterAsync(empresaId, id, cancellationToken);

        if (usuario.Perfil == PerfilUsuario.Dono && request.Perfil != PerfilUsuario.Dono)
        {
            if (usuario.Id == donoId)
                throw new RegraUsuarioException("Você não pode remover o seu próprio perfil de Dono.");
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
                throw new RegraUsuarioException("Você não pode desativar o seu próprio acesso.");
            if (usuario.Perfil == PerfilUsuario.Dono && usuario.Ativo
                && await _usuarioRepository.CountDonosAtivos(empresaId, cancellationToken) <= 1)
                throw new RegraUsuarioException("A empresa precisa de pelo menos um Dono ativo.");
        }

        if (ativo && !usuario.Ativo)
            await _assinaturas.GarantirLicencaAsync(empresaId, cancellationToken);
        usuario.Ativo = ativo;
        usuario.UpdatedAt = DateTime.UtcNow;

        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        return MapResponse(usuario);
    }

    private async Task<Usuario> ObterAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var usuario = await _usuarioRepository.GetByIdAsync(empresaId, id, cancellationToken);
        return usuario ?? throw new NotFoundException("Usuário não encontrado.");
    }

    private static void ValidarPerfil(PerfilUsuario perfil)
    {
        if (perfil is not (PerfilUsuario.Dono or PerfilUsuario.Agente))
            throw new ArgumentException("Perfil inválido.");
    }

    private static UsuarioResponse MapResponse(Usuario usuario) => new()
    {
        Id = usuario.Id,
        Nome = usuario.Nome,
        Email = usuario.Email,
        Perfil = usuario.Perfil,
        Ativo = usuario.Ativo,
        DeveTrocarSenha = usuario.DeveTrocarSenha,
        ConvitePendente = usuario.EmailConfirmadoEm == null,
        UltimoAcessoEm = usuario.UltimoAcessoEm,
        CreatedAt = usuario.CreatedAt
    };
}
