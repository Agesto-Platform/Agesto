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

    // O Dono cria o acesso de um funcionário. Outro Dono recebe o convite por email e
    // cria a própria senha pelo link (DEC-55). O Agente já nasce com a senha que o
    // Dono definiu e o email é só o login: não precisa ser real (DEC-59).
    public async Task<UsuarioConviteResponse> CreateAsync(long empresaId, UsuarioCreateRequest request, CancellationToken cancellationToken)
    {
        ValidarPerfil(request.Perfil);
        var agente = request.Perfil == PerfilUsuario.Agente;
        if (agente && string.IsNullOrEmpty(request.Senha))
            throw new ArgumentException("Defina a senha do agente (mínimo 8 caracteres).");
        if (!agente && request.Senha is not null)
            throw new ArgumentException("O Dono cria a própria senha pelo convite no email.");

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
        if (agente)
        {
            // Acesso pronto: EmailConfirmadoEm marca que a senha já existe (como no cadastro com senha).
            usuario.Senha = _passwordHasher.HashPassword(usuario, request.Senha!);
            usuario.EmailConfirmadoEm = agora;
        }
        else
        {
            // Até o convite ser usado, a senha é um valor aleatório que ninguém conhece.
            usuario.Senha = _passwordHasher.HashPassword(usuario, AuthService.SenhaDesconhecida());
        }

        await _usuarioRepository.AddAsync(usuario, cancellationToken);
        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        if (agente)
            return new UsuarioConviteResponse { Usuario = MapResponse(usuario), EnvioHabilitado = _convites.EnvioHabilitado, ConviteEnviado = false };

        await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);
        return new UsuarioConviteResponse { Usuario = MapResponse(usuario), EnvioHabilitado = _convites.EnvioHabilitado };
    }

    // O Dono define uma senha nova para o Agente: no primeiro acesso de quem ainda
    // tinha convite pendente ou quando o agente esqueceu a senha (DEC-59). Links de
    // senha abertos deixam de valer e um bloqueio por senhas erradas é liberado.
    public async Task<UsuarioResponse> DefinirSenhaAsync(long empresaId, long id, DefinirSenhaUsuarioRequest request, CancellationToken cancellationToken)
    {
        var usuario = await ObterAsync(empresaId, id, cancellationToken);
        if (usuario.Perfil != PerfilUsuario.Agente)
            throw new RegraUsuarioException("Só a senha do Agente é definida pelo Dono. O Dono usa \"Esqueci a senha\".");
        if (string.IsNullOrEmpty(request.NovaSenha) || request.NovaSenha.Length < 8)
            throw new ArgumentException("Senha deve ter no mínimo 8 caracteres.");

        var agora = DateTime.UtcNow;
        usuario.Senha = _passwordHasher.HashPassword(usuario, request.NovaSenha);
        usuario.DeveTrocarSenha = false;
        usuario.EmailConfirmadoEm ??= agora;
        usuario.TentativasLoginFalhas = 0;
        usuario.BloqueadoAte = null;
        // A senha definida pelo Dono derruba as sessões abertas no celular do agente (SEG-01).
        usuario.VersaoSessao++;
        usuario.UpdatedAt = agora;
        await _usuarioRepository.InvalidarLinksDeSenhaAsync(usuario.Id, agora, cancellationToken);
        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        return MapResponse(usuario);
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

        // Agente promovido a Dono (KAN-32): o login do agente pode ser inventado (DEC-59),
        // então a promoção pede o email real e manda o convite para confirmá-lo. Até usar o
        // convite, a pessoa segue entrando com a senha atual; depois, tem "Esqueci a senha".
        var promovido = usuario.Perfil == PerfilUsuario.Agente && request.Perfil == PerfilUsuario.Dono;
        if (promovido)
        {
            var email = EmailRealOuErro(request.Email);
            if (email != usuario.Email && await _usuarioRepository.EmailExistsAsync(email, cancellationToken))
                throw new EmailAlreadyExistsException("Email já cadastrado.");
            usuario.Email = email;
            usuario.EmailConfirmadoEm = null;
        }

        usuario.Nome = request.Nome.Trim();
        usuario.Perfil = request.Perfil;
        usuario.UpdatedAt = DateTime.UtcNow;

        await _usuarioRepository.SaveChangesAsync(cancellationToken);
        if (promovido)
            await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);
        return MapResponse(usuario);
    }

    // Email que pode receber o convite: além do formato, o domínio precisa ter ponto
    // (o login inventado do agente, como joao@minhaempresa, não serve).
    private static string EmailRealOuErro(string? email)
    {
        const string erro = "Para promover a Dono, informe o email real da pessoa: ela recebe um convite para confirmar o email.";
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException(erro);
        var normalizado = AuthService.NormalizeEmail(email);
        var arroba = normalizado.IndexOf('@');
        var dominio = arroba > 0 ? normalizado[(arroba + 1)..] : string.Empty;
        if (dominio.Length < 3 || !dominio.Contains('.') || dominio.StartsWith('.') || dominio.EndsWith('.'))
            throw new ArgumentException(erro);
        return normalizado;
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
        // Desativar encerra as sessões de vez: ao reativar, o token antigo não volta (SEG-01).
        if (!ativo && usuario.Ativo)
            usuario.VersaoSessao++;
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
