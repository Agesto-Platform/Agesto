using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MicroERP.Api.Authorization;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Contas da equipe do Agesto (área de superadmin). Acesso direto ao DbContext,
// como o AuthService: estas consultas atravessam empresas de propósito.
public sealed class AdminAuthService : IAdminAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;
    private readonly IConviteService _convites;
    private readonly PasswordHasher<AdminPlataforma> _hasher = new();

    // Mesmo truque do AuthService: email inexistente custa o mesmo tempo que senha errada.
    private static readonly string HashFicticio = new PasswordHasher<AdminPlataforma>()
        .HashPassword(new AdminPlataforma(), Guid.NewGuid().ToString());

    public AdminAuthService(AppDbContext db, IConfiguration configuration, IConviteService convites)
    {
        _db = db;
        _configuration = configuration;
        _convites = convites;
    }

    public async Task<AdminAuthResponse?> LoginAsync(AdminLoginRequest request, string? ip, CancellationToken cancellationToken)
    {
        var email = AuthService.NormalizeEmail(request.Email);
        var admin = await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.Email == email, cancellationToken);
        if (admin is null)
        {
            _hasher.VerifyHashedPassword(new AdminPlataforma(), HashFicticio, request.Senha);
            return null;
        }

        var verificacao = _hasher.VerifyHashedPassword(admin, admin.Senha, request.Senha);
        // Admin desativado recebe a mesma resposta de senha errada. A tentativa
        // fica na auditoria (email inexistente não tem admin para registrar).
        if (verificacao == PasswordVerificationResult.Failed || !admin.Ativo)
        {
            AdminAuditoria.Registrar(_db, admin.Id, "login-falhou",
                detalhes: admin.Ativo ? "Senha incorreta" : "Conta desativada", ip: ip);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        admin.UltimoAcessoEm = DateTime.UtcNow;
        AdminAuditoria.Registrar(_db, admin.Id, "login", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);

        return GerarToken(admin);
    }

    public async Task<AdminResponse> SetupAsync(AdminCriarRequest request, string? chave, string? ip, CancellationToken cancellationToken)
    {
        var chaveEsperada = _configuration["Admin:SetupKey"];
        if (string.IsNullOrWhiteSpace(chaveEsperada))
            throw new AdminSetupException(StatusCodes.Status404NotFound, "Recurso não encontrado.");

        if (string.IsNullOrEmpty(chave)
            || !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(chave), Encoding.UTF8.GetBytes(chaveEsperada)))
        {
            throw new AdminSetupException(StatusCodes.Status401Unauthorized, "Chave de setup inválida.");
        }

        // Só cria o primeiro admin; os demais são cadastrados por um admin logado.
        if (await _db.AdminsPlataforma.AnyAsync(cancellationToken))
            throw new AdminSetupException(StatusCodes.Status409Conflict, "O primeiro administrador já foi criado.");

        var admin = await CriarContaAsync(request.Nome, request.Email, request.Senha, cancellationToken);
        AdminAuditoria.Registrar(_db, admin.Id, "setup", detalhes: $"Primeiro admin: {admin.Email}", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
        return Map(admin);
    }

    public async Task<AdminResponse> ObterAsync(long adminId, CancellationToken cancellationToken)
    {
        var admin = await _db.AdminsPlataforma.AsNoTracking().FirstOrDefaultAsync(a => a.Id == adminId, cancellationToken)
            ?? throw new NotFoundException("Administrador não encontrado.");
        return Map(admin);
    }

    public async Task<IReadOnlyList<AdminResponse>> ListarAsync(CancellationToken cancellationToken)
    {
        var admins = await _db.AdminsPlataforma.AsNoTracking().OrderBy(a => a.Nome).ToListAsync(cancellationToken);
        return admins.Select(Map).ToList();
    }

    // Novo admin nasce com o convite pendente e cria a senha pelo link (DEC-55).
    public async Task<ConviteEnviadoResponse> ConvidarAsync(long adminId, AdminConvidarRequest request, string? ip, CancellationToken cancellationToken)
    {
        var admin = await CriarContaAsync(request.Nome, request.Email, senha: null, cancellationToken);
        AdminAuditoria.Registrar(_db, adminId, "convidar-admin", detalhes: $"Novo admin: {admin.Email}", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaAdminAsync(admin, cancellationToken);
        return new ConviteEnviadoResponse { Email = admin.Email, EnvioHabilitado = _convites.EnvioHabilitado };
    }

    public async Task<ConviteEnviadoResponse> ReenviarConviteAsync(long adminId, long alvoId, string? ip, CancellationToken cancellationToken)
    {
        var alvo = await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.Id == alvoId, cancellationToken)
            ?? throw new NotFoundException("Administrador não encontrado.");
        if (alvo.EmailConfirmadoEm is not null)
            throw new InvalidOperationException("Este administrador já criou a senha.");
        if (!alvo.Ativo)
            throw new InvalidOperationException("Reative o acesso antes de reenviar o convite.");

        AdminAuditoria.Registrar(_db, adminId, "reenviar-convite-admin", detalhes: alvo.Email, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaAdminAsync(alvo, cancellationToken);
        return new ConviteEnviadoResponse { Email = alvo.Email, EnvioHabilitado = _convites.EnvioHabilitado };
    }

    // Tirar ou devolver o acesso de alguém da equipe. Desativar derruba a sessão
    // na hora (TokenRevalidator.IsAdminValidAsync). Ninguém se desativa sozinho,
    // para a área nunca ficar sem nenhum admin por engano.
    public async Task DefinirAtivoAsync(long adminId, long alvoId, bool ativo, string? ip, CancellationToken cancellationToken)
    {
        if (adminId == alvoId && !ativo)
            throw new InvalidOperationException("Você não pode desativar o seu próprio acesso.");

        var alvo = await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.Id == alvoId, cancellationToken)
            ?? throw new NotFoundException("Administrador não encontrado.");
        alvo.Ativo = ativo;

        AdminAuditoria.Registrar(_db, adminId, ativo ? "reativar-admin" : "desativar-admin", detalhes: alvo.Email, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // Com senha: o primeiro admin (setup). Sem senha: convite pendente (DEC-55).
    private async Task<AdminPlataforma> CriarContaAsync(string nome, string emailInformado, string? senha, CancellationToken cancellationToken)
    {
        var email = AuthService.NormalizeEmail(emailInformado);
        if (await _db.AdminsPlataforma.AnyAsync(a => a.Email == email, cancellationToken))
            throw new EmailAlreadyExistsException("Email já cadastrado como administrador.");

        var admin = new AdminPlataforma
        {
            Nome = nome.Trim(),
            Email = email,
            EmailConfirmadoEm = senha is null ? null : DateTime.UtcNow,
        };
        admin.Senha = _hasher.HashPassword(admin, senha ?? AuthService.SenhaDesconhecida());
        _db.AdminsPlataforma.Add(admin);
        // Salva já para o registro de auditoria ter o Id do admin criado.
        await _db.SaveChangesAsync(cancellationToken);
        return admin;
    }

    private AdminAuthResponse GerarToken(AdminPlataforma admin)
    {
        var jwt = _configuration.GetSection("Jwt");
        var segredo = jwt["Secret"] ?? throw new InvalidOperationException("JWT secret not configured.");
        var audiencia = AdminAuth.Audiencia(jwt["Audience"] ?? string.Empty);
        var minutos = _configuration.GetValue("Admin:ExpiresMinutes", 43200);
        var expiraEm = DateTime.UtcNow.AddMinutes(minutos);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, admin.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, admin.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Name, admin.Nome),
            new(AdminAuth.ClaimEscopo, AdminAuth.EscopoPlataforma),
        };

        var credenciais = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(segredo)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(jwt["Issuer"], audiencia, claims, expires: expiraEm, signingCredentials: credenciais);

        return new AdminAuthResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt = expiraEm,
            Admin = Map(admin),
        };
    }

    private static AdminResponse Map(AdminPlataforma a) => new()
    {
        Id = a.Id,
        Nome = a.Nome,
        Email = a.Email,
        Ativo = a.Ativo,
        ConvitePendente = a.EmailConfirmadoEm == null,
        UltimoAcessoEm = a.UltimoAcessoEm,
        CreatedAt = a.CreatedAt,
    };
}

// Grava a ação no log de auditoria; é salva junto com a alteração auditada.
internal static class AdminAuditoria
{
    public static void Registrar(
        AppDbContext db, long adminId, string acao,
        long? empresaId = null, long? usuarioId = null, string? detalhes = null, string? ip = null)
    {
        db.AuditoriasAdmin.Add(new AuditoriaAdmin
        {
            AdminId = adminId,
            Acao = acao,
            EmpresaId = empresaId,
            UsuarioId = usuarioId,
            Detalhes = detalhes is { Length: > 500 } ? detalhes[..500] : detalhes,
            Ip = ip is { Length: > 64 } ? ip[..64] : ip,
            CreatedAt = DateTime.UtcNow,
        });
    }
}
