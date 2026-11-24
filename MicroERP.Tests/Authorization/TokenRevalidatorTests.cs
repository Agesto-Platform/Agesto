using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Authorization;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;

namespace MicroERP.Tests.Authorization;

public sealed class TokenRevalidatorTests
{
    [Fact]
    public async Task UsuarioAtivoComMesmosDados_EhValido()
    {
        await using var db = await Seed();
        Assert.True(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));
    }

    [Theory]
    [InlineData("99", "10", "Dono")]   // usuário excluído
    [InlineData("1", "20", "Dono")]    // empresa diferente
    [InlineData("1", "10", "Agente")]  // perfil mudou desde a emissão
    [InlineData("abc", "10", "Dono")]  // sub inválido
    public async Task TokenDivergenteDoBanco_EhInvalido(string sub, string empresaId, string perfil)
    {
        await using var db = await Seed();
        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal(sub, empresaId, perfil), CancellationToken.None));
    }

    [Fact]
    public async Task UsuarioDesativado_EhInvalido()
    {
        await using var db = await Seed();
        var usuario = await db.Usuarios.SingleAsync();
        usuario.Ativo = false;
        await db.SaveChangesAsync();

        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));
    }

    [Fact]
    public async Task UsuarioQueExcluiuAConta_PerdeOToken()
    {
        await using var db = await Seed();
        var usuario = await db.Usuarios.SingleAsync();
        usuario.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));
    }

    [Fact]
    public async Task EmpresaSuspensa_DerrubaTokenDosUsuarios()
    {
        await using var db = await Seed();
        var empresa = await db.Empresas.SingleAsync();
        empresa.Ativa = false;
        await db.SaveChangesAsync();

        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));
    }

    [Fact]
    public async Task VersaoDeSessaoAntiga_EhInvalida()
    {
        await using var db = await Seed();
        var usuario = await db.Usuarios.SingleAsync();
        usuario.VersaoSessao = 2;
        await db.SaveChangesAsync();

        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono", "1"), CancellationToken.None));
        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono", "x"), CancellationToken.None));
        Assert.True(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono", "2"), CancellationToken.None));
    }

    [Fact]
    public async Task TokenSemVersao_ValeSoEnquantoAVersaoForZero()
    {
        await using var db = await Seed();
        Assert.True(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));

        var usuario = await db.Usuarios.SingleAsync();
        usuario.VersaoSessao = 1;
        await db.SaveChangesAsync();

        Assert.False(await TokenRevalidator.IsValidAsync(db, Principal("1", "10", "Dono"), CancellationToken.None));
    }

    [Fact]
    public async Task TokenDeAdmin_SoValeComAdminAtivoEEscopoDePlataforma()
    {
        await using var db = await Seed();
        db.AdminsPlataforma.Add(new AdminPlataforma { Id = 5, Nome = "Equipe", Email = "equipe@agesto.com", Senha = "x" });
        await db.SaveChangesAsync();

        Assert.True(await TokenRevalidator.IsAdminValidAsync(db, Admin("5", "plataforma"), CancellationToken.None));
        Assert.False(await TokenRevalidator.IsAdminValidAsync(db, Admin("5", "outro"), CancellationToken.None));
        Assert.False(await TokenRevalidator.IsAdminValidAsync(db, Admin("6", "plataforma"), CancellationToken.None));

        var admin = await db.AdminsPlataforma.SingleAsync();
        admin.Ativo = false;
        await db.SaveChangesAsync();
        Assert.False(await TokenRevalidator.IsAdminValidAsync(db, Admin("5", "plataforma"), CancellationToken.None));
    }

    private static ClaimsPrincipal Admin(string sub, string escopo) =>
        new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, sub), new Claim("escopo", escopo)], "test"));

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Empresas.Add(new Empresa { Id = 10, Nome = "Empresa" });
        db.Usuarios.Add(new Usuario { Id = 1, Nome = "Dono", Email = "dono@teste.com", EmpresaId = 10, Perfil = PerfilUsuario.Dono });
        await db.SaveChangesAsync();
        return db;
    }

    private static ClaimsPrincipal Principal(string sub, string empresaId, string perfil, string? versaoSessao = null)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, sub),
            new("empresaId", empresaId),
            new("perfil", perfil)
        };
        if (versaoSessao is not null)
            claims.Add(new Claim(TokenRevalidator.ClaimVersaoSessao, versaoSessao));
        return new(new ClaimsIdentity(claims, "test"));
    }
}
