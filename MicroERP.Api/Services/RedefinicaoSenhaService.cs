using System.Net;
using System.Security.Cryptography;
using System.Text;
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

// "Esqueci a senha" do Dono por email (DEC-54), seguindo o SECURITY_NOTES, seção 3:
// - a resposta não revela se o email existe;
// - token aleatório de 32 bytes, só o hash SHA-256 no banco;
// - vale 15 minutos e uma vez só; um pedido novo invalida os anteriores;
// - o envio sai da requisição (FilaDeEmails), então a resposta leva o mesmo tempo.
// Só o Dono: o agente recebe senha provisória do Dono (DEC-35).
public sealed class RedefinicaoSenhaService : IRedefinicaoSenhaService
{
    public static readonly TimeSpan Validade = TimeSpan.FromMinutes(15);
    // Um email por conta a cada 2 minutos: evita encher a caixa de alguém.
    public static readonly TimeSpan IntervaloEntrePedidos = TimeSpan.FromMinutes(2);

    private readonly AppDbContext _db;
    private readonly IFilaDeEmails _fila;
    private readonly EmailOptions _options;
    private readonly ILogger<RedefinicaoSenhaService> _logger;
    private readonly IHostEnvironment _ambiente;
    private readonly PasswordHasher<Usuario> _hasher = new();

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
        if (usuario is null || !usuario.Ativo || usuario.Perfil != PerfilUsuario.Dono) return;

        var empresaAtiva = await _db.Empresas.AnyAsync(e => e.Id == usuario.EmpresaId && e.Ativa, cancellationToken);
        if (!empresaAtiva) return;

        var abertos = await _db.TokensRedefinicaoSenha
            .Where(t => t.UsuarioId == usuario.Id && t.UsadoEm == null && t.ExpiraEm > agora)
            .ToListAsync(cancellationToken);
        if (abertos.Any(t => agora - t.CreatedAt < IntervaloEntrePedidos)) return;

        // Só o link mais novo vale.
        foreach (var t in abertos) t.UsadoEm = agora;

        var token = GerarToken();
        _db.TokensRedefinicaoSenha.Add(new TokenRedefinicaoSenha
        {
            UsuarioId = usuario.Id,
            TokenHash = Hash(token),
            ExpiraEm = agora + Validade,
            CreatedAt = agora,
        });
        await _db.SaveChangesAsync(cancellationToken);

        var link = $"{(_options.UrlWeb ?? string.Empty).TrimEnd('/')}/redefinir-senha#token={token}";
        if (!_fila.Enfileirar(Mensagem(usuario, link)))
            _logger.LogWarning("Fila de emails cheia: o email de redefinição de senha não foi enviado.");

        // Só na máquina de desenvolvimento, para testar sem o Brevo. Nunca em produção.
        if (_ambiente.IsDevelopment())
            _logger.LogInformation("Link de redefinição de senha (só em desenvolvimento): {Link}", link);
    }

    public async Task RedefinirAsync(RedefinirSenhaRequest request, CancellationToken cancellationToken)
    {
        var agora = DateTime.UtcNow;
        var hash = Hash(request.Token.Trim());

        var registro = await _db.TokensRedefinicaoSenha
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        var usuario = registro?.Usuario;
        if (registro is null || registro.UsadoEm is not null || registro.ExpiraEm <= agora
            || usuario is null || usuario.DeletedAt is not null || !usuario.Ativo)
        {
            throw new TokenRedefinicaoInvalidoException();
        }

        usuario.Senha = _hasher.HashPassword(usuario, request.NovaSenha);
        usuario.DeveTrocarSenha = false;
        // Quem provou ter acesso ao email sai do bloqueio por senhas erradas (DEC-43).
        usuario.TentativasLoginFalhas = 0;
        usuario.BloqueadoAte = null;
        usuario.UpdatedAt = agora;

        // Uso único: este e qualquer outro link aberto da conta deixam de valer.
        var abertos = await _db.TokensRedefinicaoSenha
            .Where(t => t.UsuarioId == usuario.Id && t.UsadoEm == null)
            .ToListAsync(cancellationToken);
        foreach (var t in abertos) t.UsadoEm = agora;

        await _db.SaveChangesAsync(cancellationToken);
    }

    private static string GerarToken() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static EmailMensagem Mensagem(Usuario usuario, string link)
    {
        var nome = WebUtility.HtmlEncode(usuario.Nome);
        var linkHtml = WebUtility.HtmlEncode(link);
        var minutos = (int)Validade.TotalMinutes;
        var html = $"""
            <p>Olá, {nome}.</p>
            <p>Recebemos um pedido para redefinir a senha do seu acesso ao Agesto.</p>
            <p><a href="{linkHtml}">Criar uma senha nova</a></p>
            <p>O link vale por {minutos} minutos e funciona uma vez só.</p>
            <p>Se não foi você, ignore este email: a sua senha continua a mesma.</p>
            """;
        var texto = $"""
            Olá, {usuario.Nome}.

            Recebemos um pedido para redefinir a senha do seu acesso ao Agesto.
            Para criar uma senha nova, abra: {link}

            O link vale por {minutos} minutos e funciona uma vez só.
            Se não foi você, ignore este email: a sua senha continua a mesma.
            """;
        return new EmailMensagem(usuario.Email, usuario.Nome, "Redefinir a sua senha do Agesto", html, texto);
    }
}
