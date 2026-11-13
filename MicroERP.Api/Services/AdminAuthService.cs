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
    private readonly IEnvioCodigoAdmin _codigos;
    private readonly PasswordHasher<AdminPlataforma> _hasher = new();

    // Verificação em duas etapas por email (DEC-52). Admin:DoisFatores=false
    // desliga (só para emergência, ex.: Brevo fora do ar).
    public static readonly TimeSpan ValidadeCodigo = TimeSpan.FromMinutes(10);
    public const int TentativasDeCodigo = 5;

    // Mesmo truque do AuthService: email inexistente custa o mesmo tempo que senha errada.
    private static readonly string HashFicticio = new PasswordHasher<AdminPlataforma>()
        .HashPassword(new AdminPlataforma(), Guid.NewGuid().ToString());

    public AdminAuthService(AppDbContext db, IConfiguration configuration, IConviteService convites, IEnvioCodigoAdmin codigos)
    {
        _db = db;
        _configuration = configuration;
        _convites = convites;
        _codigos = codigos;
    }

    private bool DoisFatores => !string.Equals(_configuration["Admin:DoisFatores"], "false", StringComparison.OrdinalIgnoreCase);

    public async Task<AdminAuthResponse?> LoginAsync(AdminLoginRequest request, string? ip, CancellationToken cancellationToken)
    {
        var email = AuthService.NormalizeEmail(request.Email);
        var admin = await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.Email == email, cancellationToken);
        if (admin is null)
        {
            _hasher.VerifyHashedPassword(new AdminPlataforma(), HashFicticio, request.Senha);
            return null;
        }

        var agora = DateTime.UtcNow;

        // Bloqueada (DEC-52): nem a senha certa entra até o prazo acabar.
        if (admin.BloqueadoAte > agora)
            throw new ContaBloqueadaException(MensagemBloqueio(admin.BloqueadoAte.Value - agora));

        var verificacao = _hasher.VerifyHashedPassword(admin, admin.Senha, request.Senha);
        // Admin desativado recebe a mesma resposta de senha errada. A tentativa
        // fica na auditoria (email inexistente não tem admin para registrar).
        if (verificacao == PasswordVerificationResult.Failed || !admin.Ativo)
        {
            AdminAuditoria.Registrar(_db, admin.Id, "login-falhou",
                detalhes: admin.Ativo ? "Senha incorreta" : "Conta desativada", ip: ip);
            admin.TentativasLoginFalhas++;
            if (admin.TentativasLoginFalhas >= AuthService.TentativasAteBloquear)
            {
                admin.TentativasLoginFalhas = 0;
                admin.BloqueadoAte = agora + AuthService.TempoDeBloqueio;
                LimparDesafio(admin);
                AdminAuditoria.Registrar(_db, admin.Id, "conta-bloqueada",
                    detalhes: $"{AuthService.TentativasAteBloquear} senhas erradas seguidas", ip: ip);
                await _db.SaveChangesAsync(cancellationToken);
                throw new ContaBloqueadaException(MensagemBloqueio(AuthService.TempoDeBloqueio));
            }
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        admin.TentativasLoginFalhas = 0;
        admin.BloqueadoAte = null;

        if (DoisFatores)
        {
            // Segunda etapa: código de 6 dígitos por email, amarrado a este login pelo desafio.
            var desafio = Base64Url(RandomNumberGenerator.GetBytes(32));
            var codigo = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            admin.DesafioLoginHash = LinksDeSenha.Hash(desafio);
            admin.CodigoLoginHash = LinksDeSenha.Hash($"{desafio}:{codigo}");
            admin.CodigoLoginExpiraEm = agora + ValidadeCodigo;
            admin.CodigoLoginTentativas = 0;
            AdminAuditoria.Registrar(_db, admin.Id, "login-codigo-enviado", ip: ip);
            await _db.SaveChangesAsync(cancellationToken);
            _codigos.Enviar(admin, codigo);

            return new AdminAuthResponse
            {
                ExigeCodigo = true,
                Desafio = desafio,
                EmailMascarado = MascararEmail(admin.Email),
            };
        }

        admin.UltimoAcessoEm = agora;
        AdminAuditoria.Registrar(_db, admin.Id, "login", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);

        return GerarToken(admin);
    }

    // Segunda etapa do login (DEC-52): o desafio desta tentativa e o código do email.
    public async Task<AdminAuthResponse?> ConfirmarCodigoAsync(AdminCodigoRequest request, string? ip, CancellationToken cancellationToken)
    {
        var desafio = request.Desafio.Trim();
        var codigo = new string(request.Codigo.Where(char.IsDigit).ToArray());
        if (desafio.Length == 0 || codigo.Length != 6) return null;

        var hashDesafio = LinksDeSenha.Hash(desafio);
        var admin = await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.DesafioLoginHash == hashDesafio, cancellationToken);
        if (admin is null) return null;

        var agora = DateTime.UtcNow;
        if (admin.BloqueadoAte > agora)
            throw new ContaBloqueadaException(MensagemBloqueio(admin.BloqueadoAte.Value - agora));

        if (!admin.Ativo || admin.CodigoLoginExpiraEm is null || admin.CodigoLoginExpiraEm < agora)
        {
            LimparDesafio(admin);
            AdminAuditoria.Registrar(_db, admin.Id, "login-codigo-falhou", detalhes: "Código expirado", ip: ip);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        var esperado = Encoding.UTF8.GetBytes(admin.CodigoLoginHash ?? string.Empty);
        var recebido = Encoding.UTF8.GetBytes(LinksDeSenha.Hash($"{desafio}:{codigo}"));
        if (!CryptographicOperations.FixedTimeEquals(esperado, recebido))
        {
            admin.CodigoLoginTentativas++;
            var esgotou = admin.CodigoLoginTentativas >= TentativasDeCodigo;
            if (esgotou) LimparDesafio(admin);
            AdminAuditoria.Registrar(_db, admin.Id, "login-codigo-falhou",
                detalhes: esgotou ? "Código errado; tentativas esgotadas" : "Código errado", ip: ip);
            await _db.SaveChangesAsync(cancellationToken);
            return null;
        }

        LimparDesafio(admin);
        admin.UltimoAcessoEm = agora;
        AdminAuditoria.Registrar(_db, admin.Id, "login", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
        return GerarToken(admin);
    }

    private static void LimparDesafio(AdminPlataforma admin)
    {
        admin.DesafioLoginHash = null;
        admin.CodigoLoginHash = null;
        admin.CodigoLoginExpiraEm = null;
        admin.CodigoLoginTentativas = 0;
    }

    private static string MensagemBloqueio(TimeSpan restante)
    {
        var minutos = Math.Max(1, (int)Math.Ceiling(restante.TotalMinutes));
        return $"Conta bloqueada por excesso de tentativas. Tente de novo em {minutos} min.";
    }

    // "davi@empresa.com" -> "da***@empresa.com": a tela diz para onde foi o código.
    public static string MascararEmail(string email)
    {
        var arroba = email.IndexOf('@');
        if (arroba <= 0) return email;
        var nome = email[..arroba];
        return $"{nome[..Math.Min(2, nome.Length)]}***{email[arroba..]}";
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

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
        AppDbContext db, long? adminId, string acao,
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
