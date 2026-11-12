using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Email;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// "Esqueci a senha" (DEC-54) e criação de senha pelo link do email (DEC-55),
// seguindo o SECURITY_NOTES, seção 3:
// - o pedido responde igual exista o email ou não;
// - o link vale 15 minutos (esqueci) ou 72 horas (convite da equipe), uma vez só;
// - o envio sai da requisição (FilaDeEmails), então a resposta leva o mesmo tempo.
// Dono e Agente podem pedir; a equipe do Agesto usa o próprio convite.
public sealed class RedefinicaoSenhaService : IRedefinicaoSenhaService
{
    // Um email por conta a cada 2 minutos: evita encher a caixa de alguém.
    public static readonly TimeSpan IntervaloEntrePedidos = TimeSpan.FromMinutes(2);

    private readonly AppDbContext _db;
    private readonly IFilaDeEmails _fila;
    private readonly EmailOptions _options;
    private readonly ILogger<RedefinicaoSenhaService> _logger;
    private readonly IHostEnvironment _ambiente;
    private readonly PasswordHasher<Usuario> _hasher = new();
    private readonly PasswordHasher<AdminPlataforma> _hasherAdmin = new();

    public RedefinicaoSenhaService(
        AppDbContext db,
        IFilaDeEmails fila,
        IOptions<EmailOptions> options,
        ILogger<RedefinicaoSenhaService> logger,
        IHostEnvironment ambiente)
    {
        _db = db;
        _fila = fila;
        _options = options.Value;
        _logger = logger;
        _ambiente = ambiente;
    }

    public async Task SolicitarAsync(EsqueciSenhaRequest request, CancellationToken cancellationToken)
    {
        var email = AuthService.NormalizeEmail(request.Email);
        var agora = DateTime.UtcNow;

        var usuario = await _db.Usuarios
            .FirstOrDefaultAsync(u => u.Email == email && u.DeletedAt == null, cancellationToken);
        if (usuario is null || !usuario.Ativo || usuario.Perfil is not (PerfilUsuario.Dono or PerfilUsuario.Agente)) return;

        var empresaAtiva = await _db.Empresas.AnyAsync(e => e.Id == usuario.EmpresaId && e.Ativa, cancellationToken);
        if (!empresaAtiva) return;

        var recente = await LinksDeSenha.Abertos(_db, usuario.Id, null)
            .AnyAsync(t => t.ExpiraEm > agora && t.CreatedAt > agora - IntervaloEntrePedidos, cancellationToken);
        if (recente) return;

        // Um link novo invalida os anteriores, inclusive um convite ainda aberto.
        var token = await LinksDeSenha.EmitirAsync(_db, usuario.Id, null, TipoTokenSenha.Redefinicao, agora, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var link = LinksDeSenha.Link(_options.UrlWeb, "/redefinir-senha", token);
        if (!_fila.Enfileirar(EmailsDeSenha.Redefinicao(usuario.Email, usuario.Nome, link)))
            _logger.LogWarning("Fila de emails cheia: o email de redefinição de senha não foi enviado.");

        // Só na máquina de desenvolvimento, para testar sem o Brevo. Nunca em produção.
        if (_ambiente.IsDevelopment())
            _logger.LogInformation("Link de redefinição de senha (só em desenvolvimento): {Link}", link);
    }

    public async Task<PerfilUsuario> RedefinirAsync(RedefinirSenhaRequest request, CancellationToken cancellationToken)
    {
        var agora = DateTime.UtcNow;
        var registro = await ObterValidoAsync(request.Token, agora, cancellationToken);
        var usuario = registro?.UsuarioId is null
            ? null
            : await _db.Usuarios.FirstOrDefaultAsync(u => u.Id == registro.UsuarioId, cancellationToken);
        if (registro is null || usuario is null || usuario.DeletedAt is not null || !usuario.Ativo)
            throw new TokenRedefinicaoInvalidoException();

        usuario.Senha = _hasher.HashPassword(usuario, request.NovaSenha);
        usuario.DeveTrocarSenha = false;
        // Abrir o link do email confirma o email (DEC-55).
        usuario.EmailConfirmadoEm ??= agora;
        // Quem provou ter acesso ao email sai do bloqueio por senhas erradas (DEC-43).
        usuario.TentativasLoginFalhas = 0;
        usuario.BloqueadoAte = null;
        usuario.UpdatedAt = agora;

        await InvalidarAsync(usuario.Id, null, agora, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return usuario.Perfil;
    }

    public async Task CriarSenhaAdminAsync(AdminCriarSenhaRequest request, CancellationToken cancellationToken)
    {
        var agora = DateTime.UtcNow;
        var registro = await ObterValidoAsync(request.Token, agora, cancellationToken);
        var admin = registro?.AdminId is null
            ? null
            : await _db.AdminsPlataforma.FirstOrDefaultAsync(a => a.Id == registro.AdminId, cancellationToken);
        if (registro is null || admin is null || !admin.Ativo)
            throw new TokenRedefinicaoInvalidoException();

        admin.Senha = _hasherAdmin.HashPassword(admin, request.NovaSenha);
        admin.EmailConfirmadoEm ??= agora;
        admin.UpdatedAt = agora;

        AdminAuditoria.Registrar(_db, admin.Id, "criar-senha", detalhes: admin.Email);
        await InvalidarAsync(null, admin.Id, agora, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<TokenRedefinicaoSenha?> ObterValidoAsync(string token, DateTime agora, CancellationToken cancellationToken)
    {
        var hash = LinksDeSenha.Hash(token.Trim());
        var registro = await _db.TokensRedefinicaoSenha.FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        return registro is null || registro.UsadoEm is not null || registro.ExpiraEm <= agora ? null : registro;
    }

    // Uso único: o link usado e qualquer outro aberto da conta deixam de valer.
    private async Task InvalidarAsync(long? usuarioId, long? adminId, DateTime agora, CancellationToken cancellationToken)
    {
        var abertos = await LinksDeSenha.Abertos(_db, usuarioId, adminId).ToListAsync(cancellationToken);
        foreach (var t in abertos) t.UsadoEm = agora;
    }
}
