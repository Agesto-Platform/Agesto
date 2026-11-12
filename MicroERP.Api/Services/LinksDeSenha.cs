using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;

namespace MicroERP.Api.Services;

// Links por email para criar ou redefinir a senha (DEC-54 e DEC-55), seguindo o
// SECURITY_NOTES, seção 3: token aleatório de 32 bytes, só o hash SHA-256 no
// banco, validade curta e uso único. Um link novo invalida os anteriores da conta.
public static class LinksDeSenha
{
    public static readonly TimeSpan ValidadeRedefinicao = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan ValidadeConvite = TimeSpan.FromHours(72);

    public static TimeSpan Validade(TipoTokenSenha tipo) =>
        tipo == TipoTokenSenha.Convite ? ValidadeConvite : ValidadeRedefinicao;

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    // Cria o link de um usuário (usuarioId) ou de um admin (adminId) e invalida os
    // abertos da mesma conta. Devolve o token em claro, que só vai no email; quem
    // chama salva o contexto.
    public static async Task<string> EmitirAsync(
        AppDbContext db, long? usuarioId, long? adminId, TipoTokenSenha tipo, DateTime agora, CancellationToken cancellationToken)
    {
        var abertos = await Abertos(db, usuarioId, adminId).ToListAsync(cancellationToken);
        foreach (var t in abertos) t.UsadoEm = agora;

        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        db.TokensRedefinicaoSenha.Add(new TokenRedefinicaoSenha
        {
            UsuarioId = usuarioId,
            AdminId = adminId,
            Tipo = tipo,
            TokenHash = Hash(token),
            ExpiraEm = agora + Validade(tipo),
            CreatedAt = agora,
        });
        return token;
    }

    // Links da conta ainda não usados (vencidos ou não).
    public static IQueryable<TokenRedefinicaoSenha> Abertos(AppDbContext db, long? usuarioId, long? adminId) =>
        db.TokensRedefinicaoSenha.Where(t => t.UsadoEm == null
            && (usuarioId != null ? t.UsuarioId == usuarioId : t.AdminId == adminId));

    // {UrlWeb}{caminho}#token=...: depois do `#`, o token não vai ao servidor do web nem a logs.
    public static string Link(string? urlWeb, string caminho, string token) =>
        $"{(urlWeb ?? string.Empty).TrimEnd('/')}{caminho}#token={token}";

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
