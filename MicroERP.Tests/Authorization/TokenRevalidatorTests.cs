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

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Usuarios.Add(new Usuario { Id = 1, Nome = "Dono", Email = "dono@teste.com", EmpresaId = 10, Perfil = PerfilUsuario.Dono });
        await db.SaveChangesAsync();
        return db;
    }

    private static ClaimsPrincipal Principal(string sub, string empresaId, string perfil) =>
        new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, sub),
            new Claim("empresaId", empresaId),
            new Claim("perfil", perfil)
        ], "test"));
}
