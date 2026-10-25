using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using MicroERP.Api.Enums;

namespace MicroERP.Api.Services;

public sealed class AuthService : IAuthService
{
    private readonly AppDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<Usuario> _passwordHasher = new();

    // Hash de uma senha qualquer, verificado quando o email não existe: o login
    // leva o mesmo tempo nos dois casos e não revela quais emails têm conta.
    private static readonly string HashFicticio = new PasswordHasher<Usuario>()
        .HashPassword(new Usuario(), Guid.NewGuid().ToString());

    // Bloqueio por conta (complementa o rate limit por IP): 5 senhas erradas seguidas, 15 minutos.
    public const int TentativasAteBloquear = 5;
    public static readonly TimeSpan TempoDeBloqueio = TimeSpan.FromMinutes(15);

    public AuthService(AppDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    public async Task RegisterAsync(AuthRegisterRequest request, CancellationToken cancellationToken)
    {

        // Normaliza o email para evitar duplicatas por diferenças de maiúsculas/minúsculas ou espaços

        var email = NormalizeEmail(request.Email);
        var emailExists = await _dbContext.Usuarios
            .AsNoTracking()
            .AnyAsync(u => u.Email == email, cancellationToken);

        if (emailExists)
        {
            throw new EmailAlreadyExistsException("Email já cadastrado.");
        }

        // Empresa, usuário e configuração nascem juntos ou nenhum deles.
        await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var empresa = new Empresa
        {
            Nome = request.NomeEmpresa,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,

        };
        _dbContext.Empresas.Add(empresa);
        await _dbContext.SaveChangesAsync(cancellationToken); 

        var usuario = new Usuario
        {
            Nome = request.Nome,
            Email = email,
            Senha = string.Empty, // A senha será definida após o hash
            EmpresaId = empresa.Id,
            Perfil = Enums.PerfilUsuario.Dono,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        usuario.Senha = _passwordHasher.HashPassword(usuario, request.Senha);
        _dbContext.Usuarios.Add(usuario);

        var configuracao = new Configuracao
        {
            EmpresaId = empresa.Id,
            TipoOperacao = TipoOperacao.Hibrido,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _dbContext.Configuracoes.Add(configuracao);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task<AuthResponse?> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);

        var usuario = await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (usuario is null)
        {
            _passwordHasher.VerifyHashedPassword(new Usuario(), HashFicticio, request.Senha);
            return null;
        }

        var agora = DateTime.UtcNow;

        // Bloqueada: nem a senha certa entra até o prazo acabar.
        if (usuario.BloqueadoAte > agora)
        {
            throw new ContaBloqueadaException(MensagemBloqueio(usuario.BloqueadoAte.Value - agora));
        }

        var verification = _passwordHasher.VerifyHashedPassword(usuario, usuario.Senha, request.Senha);
        if (verification == PasswordVerificationResult.Failed)
        {
            usuario.TentativasLoginFalhas++;
            if (usuario.TentativasLoginFalhas >= TentativasAteBloquear)
            {
                usuario.TentativasLoginFalhas = 0;
                usuario.BloqueadoAte = agora + TempoDeBloqueio;
                await _dbContext.SaveChangesAsync(cancellationToken);
                throw new ContaBloqueadaException(MensagemBloqueio(TempoDeBloqueio));
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return null;
        }

        // Só depois da senha correta: não revela a quem não sabe a senha que a conta existe.
        if (!usuario.Ativo)
        {
            throw new UsuarioInativoException("Acesso desativado. Fale com o responsável pela empresa.");
        }

        usuario.TentativasLoginFalhas = 0;
        usuario.BloqueadoAte = null;
        usuario.UltimoAcessoEm = agora;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return GenerateToken(usuario);
    }

    public async Task TrocarSenhaAsync(long usuarioId, TrocarSenhaRequest request, CancellationToken cancellationToken)
    {
        var usuario = await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Id == usuarioId, cancellationToken)
            ?? throw new NotFoundException("Usuário não encontrado.");

        var verification = _passwordHasher.VerifyHashedPassword(usuario, usuario.Senha, request.SenhaAtual);
        if (verification == PasswordVerificationResult.Failed)
        {
            throw new SenhaAtualInvalidaException("Senha atual incorreta.");
        }

        if (request.NovaSenha == request.SenhaAtual)
        {
            throw new ArgumentException("A nova senha deve ser diferente da atual.");
        }

        usuario.Senha = _passwordHasher.HashPassword(usuario, request.NovaSenha);
        usuario.DeveTrocarSenha = false;
        usuario.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

    private static string MensagemBloqueio(TimeSpan restante)
    {
        var minutos = Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes));
        return $"Conta bloqueada por excesso de tentativas. Tente de novo em {minutos} min.";
    }

    private AuthResponse GenerateToken(Usuario usuario)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var jwtSecret = jwtSection["Secret"] ?? throw new InvalidOperationException("JWT secret not configured.");
        var jwtIssuer = jwtSection["Issuer"] ?? string.Empty;
        var jwtAudience = jwtSection["Audience"] ?? string.Empty;
        var expiresMinutes = jwtSection.GetValue("ExpiresMinutes", 120);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, usuario.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("empresaId", usuario.EmpresaId.ToString()),
            new("perfil", usuario.Perfil.ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);

        var token = new JwtSecurityToken(
            issuer: string.IsNullOrWhiteSpace(jwtIssuer) ? null : jwtIssuer,
            audience: string.IsNullOrWhiteSpace(jwtAudience) ? null : jwtAudience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        var tokenValue = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthResponse
        {
            Token = tokenValue,
            ExpiresAt = expiresAt,
            DeveTrocarSenha = usuario.DeveTrocarSenha
        };
    }
}
