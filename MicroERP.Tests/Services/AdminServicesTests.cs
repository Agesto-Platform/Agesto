using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

public sealed class AdminServicesTests
{
    private const string ChaveSetup = "chave-de-setup-de-teste";

    [Fact]
    public async Task Setup_CriaPrimeiroAdminSoComAChaveCertaEUmaVez()
    {
        await using var db = CreateContext();
        var service = new AdminAuthService(db, Config());
        var request = new AdminCriarRequest { Nome = "Equipe", Email = "Equipe@Agesto.com ", Senha = "senha-bem-longa-123" };

        var semChave = await Assert.ThrowsAsync<AdminSetupException>(() => service.SetupAsync(request, "errada", null, CancellationToken.None));
        Assert.Equal(401, semChave.StatusCode);

        var admin = await service.SetupAsync(request, ChaveSetup, "1.2.3.4", CancellationToken.None);
        Assert.Equal("equipe@agesto.com", admin.Email);
        Assert.Single(db.AuditoriasAdmin.Where(a => a.Acao == "setup"));

        var segunda = await Assert.ThrowsAsync<AdminSetupException>(() => service.SetupAsync(
            new AdminCriarRequest { Nome = "Outro", Email = "outro@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None));
        Assert.Equal(409, segunda.StatusCode);
    }

    [Fact]
    public async Task Setup_SemChaveConfigurada_FicaDesligado()
    {
        await using var db = CreateContext();
        var service = new AdminAuthService(db, Config(setupKey: null));

        var ex = await Assert.ThrowsAsync<AdminSetupException>(() => service.SetupAsync(
            new AdminCriarRequest { Nome = "Equipe", Email = "equipe@agesto.com", Senha = "senha-bem-longa-123" },
            "qualquer", null, CancellationToken.None));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task Login_TokenDeAdminTemAudienciaPropriaENaoTemEmpresa()
    {
        await using var db = CreateContext();
        var service = new AdminAuthService(db, Config());
        await service.SetupAsync(new AdminCriarRequest { Nome = "Equipe", Email = "equipe@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None);

        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "equipe@agesto.com", Senha = "errada" }, null, CancellationToken.None));
        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "ninguem@agesto.com", Senha = "x" }, null, CancellationToken.None));

        var ok = await service.LoginAsync(new AdminLoginRequest { Email = "equipe@agesto.com", Senha = "senha-bem-longa-123" }, null, CancellationToken.None);
        Assert.NotNull(ok);

        var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(ok!.Token);
        Assert.Contains("MicroERP.Api.Admin", jwt.Audiences);
        Assert.DoesNotContain("MicroERP.Api", jwt.Audiences);
        Assert.Equal("plataforma", jwt.Claims.Single(c => c.Type == "escopo").Value);
        Assert.DoesNotContain(jwt.Claims, c => c.Type is "empresaId" or "perfil");
    }

    [Fact]
    public async Task DesativarAdmin_CortaOAcessoMasNinguemSeDesativaSozinho()
    {
        await using var db = CreateContext();
        var service = new AdminAuthService(db, Config());
        var eu = await service.SetupAsync(new AdminCriarRequest { Nome = "Eu", Email = "eu@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None);
        var outro = await service.CriarAsync(eu.Id,
            new AdminCriarRequest { Nome = "Saiu", Email = "saiu@agesto.com", Senha = "senha-bem-longa-456" }, null, CancellationToken.None);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DefinirAtivoAsync(eu.Id, eu.Id, false, null, CancellationToken.None));

        await service.DefinirAtivoAsync(eu.Id, outro.Id, false, null, CancellationToken.None);
        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "saiu@agesto.com", Senha = "senha-bem-longa-456" }, null, CancellationToken.None));
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "desativar-admin" && a.Detalhes == "saiu@agesto.com");
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "login-falhou" && a.AdminId == outro.Id);
    }

    [Fact]
    public async Task Login_AdminDesativado_NaoEntra()
    {
        await using var db = CreateContext();
        var admin = new AdminPlataforma { Nome = "Ex", Email = "ex@agesto.com", Ativo = false };
        admin.Senha = new PasswordHasher<AdminPlataforma>().HashPassword(admin, "senha-bem-longa-123");
        db.AdminsPlataforma.Add(admin);
        await db.SaveChangesAsync();

        var service = new AdminAuthService(db, Config());
        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "ex@agesto.com", Senha = "senha-bem-longa-123" }, null, CancellationToken.None));
    }

    [Fact]
    public async Task CriarEmpresa_CriaDonoComSenhaProvisoriaEAudita()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        var service = new AdminEmpresaService(db, new AuthService(db, Config()));

        var criada = await service.CriarAsync(adminId,
            new EmpresaAdminCriarRequest { NomeEmpresa = "Clima Frio", NomeDono = "Ana", EmailDono = "ANA@clima.com" },
            null, CancellationToken.None);

        var dono = await db.Usuarios.SingleAsync();
        Assert.Equal("ana@clima.com", dono.Email);
        Assert.Equal(PerfilUsuario.Dono, dono.Perfil);
        Assert.True(dono.DeveTrocarSenha);
        Assert.Equal(criada.EmpresaId, dono.EmpresaId);
        Assert.Equal(10, criada.SenhaProvisoria.Length);
        Assert.NotEqual(criada.SenhaProvisoria, dono.Senha);
        Assert.Single(db.Configuracoes.Where(c => c.EmpresaId == criada.EmpresaId));

        var log = await db.AuditoriasAdmin.SingleAsync(a => a.Acao == "criar-empresa");
        Assert.Equal(criada.EmpresaId, log.EmpresaId);
        Assert.DoesNotContain(criada.SenhaProvisoria, log.Detalhes ?? "");
    }

    [Fact]
    public async Task BloquearEDesbloquear_MudamAEmpresaEAuditam()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        db.Empresas.Add(new Empresa { Id = 7, Nome = "Inadimplente" });
        await db.SaveChangesAsync();
        var service = new AdminEmpresaService(db, new AuthService(db, Config()));

        await service.BloquearAsync(adminId, 7, "Mensalidade atrasada", null, CancellationToken.None);
        var empresa = await db.Empresas.SingleAsync(e => e.Id == 7);
        Assert.False(empresa.Ativa);
        Assert.Equal("Mensalidade atrasada", empresa.MotivoBloqueio);
        Assert.NotNull(empresa.BloqueadaEm);

        await service.DesbloquearAsync(adminId, 7, null, CancellationToken.None);
        Assert.True(empresa.Ativa);
        Assert.Null(empresa.MotivoBloqueio);

        Assert.Equal(["bloquear-empresa", "desbloquear-empresa"],
            await db.AuditoriasAdmin.OrderBy(a => a.Id).Select(a => a.Acao).ToListAsync());
        await Assert.ThrowsAsync<NotFoundException>(() => service.BloquearAsync(adminId, 999, "x", null, CancellationToken.None));
    }

    [Fact]
    public async Task UsuarioDeOutraEmpresa_NaoPodeSerAlteradoPelaRotaErrada()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "A" }, new Empresa { Id = 2, Nome = "B" });
        db.Usuarios.Add(new Usuario { Id = 20, Nome = "Bia", Email = "bia@b.com", Senha = "hash", EmpresaId = 2 });
        await db.SaveChangesAsync();
        var service = new AdminEmpresaService(db, new AuthService(db, Config()));

        await Assert.ThrowsAsync<NotFoundException>(() => service.DefinirUsuarioAtivoAsync(adminId, 1, 20, false, null, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.RedefinirSenhaAsync(adminId, 1, 20, null, CancellationToken.None));

        await service.DefinirUsuarioAtivoAsync(adminId, 2, 20, false, null, CancellationToken.None);
        Assert.False((await db.Usuarios.SingleAsync()).Ativo);

        var nova = await service.RedefinirSenhaAsync(adminId, 2, 20, null, CancellationToken.None);
        var usuario = await db.Usuarios.SingleAsync();
        Assert.True(usuario.DeveTrocarSenha);
        Assert.Equal(PasswordVerificationResult.Success,
            new PasswordHasher<Usuario>().VerifyHashedPassword(usuario, usuario.Senha, nova.SenhaProvisoria));
    }

    [Fact]
    public async Task LoginDeCliente_EmpresaSuspensa_EhBarrado()
    {
        await using var db = CreateContext();
        var auth = new AuthService(db, Config());
        await auth.RegisterAsync(new AuthRegisterRequest { NomeEmpresa = "Loja", Nome = "Dono", Email = "dono@loja.com", Senha = "Senha123!" }, CancellationToken.None);

        var empresa = await db.Empresas.SingleAsync();
        empresa.Ativa = false;
        await db.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<UsuarioInativoException>(() =>
            auth.LoginAsync(new AuthLoginRequest { Email = "dono@loja.com", Senha = "Senha123!" }, CancellationToken.None));
        Assert.Contains("suspenso", ex.Message);
    }

    private static async Task<long> SeedAdmin(AppDbContext db)
    {
        var admin = new AdminPlataforma { Nome = "Equipe", Email = "equipe@agesto.com", Senha = "hash" };
        db.AdminsPlataforma.Add(admin);
        await db.SaveChangesAsync();
        return admin.Id;
    }

    private static IConfiguration Config(string? setupKey = ChaveSetup) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "uma-chave-de-teste-com-pelo-menos-32-bytes!!",
            ["Jwt:Issuer"] = "MicroERP.Api",
            ["Jwt:Audience"] = "MicroERP.Api",
            ["Admin:SetupKey"] = setupKey,
        }).Build();

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
}
