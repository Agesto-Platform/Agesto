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
            throw new EmailAlreadyExistsException("Email ja cadastrado.");
        }

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
    }

    public async Task<AuthResponse?> LoginAsync(AuthLoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);

        var usuario = await _dbContext.Usuarios
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (usuario is null)
        {
            return null;
        }

        var verification = _passwordHasher.VerifyHashedPassword(usuario, usuario.Senha, request.Senha);
        if (verification == PasswordVerificationResult.Failed)
        {
            return null;
        }

        return GenerateToken(usuario);
    }

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

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
            ExpiresAt = expiresAt
        };
    }
}
