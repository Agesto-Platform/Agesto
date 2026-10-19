using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

public sealed class UsuarioServiceTests
{
    private const long Empresa = 1;
    private const long OutraEmpresa = 2;
    private const long DonoId = 100;

    [Fact]
    public async Task CreateAsync_CriaAgenteComSenhaProvisoriaQueFazLogin()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        var criado = await service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = " Carlos ", Email = " Carlos@Teste.com " }, CancellationToken.None);

        Assert.Equal("Carlos", criado.Usuario.Nome);
        Assert.Equal("carlos@teste.com", criado.Usuario.Email);
        Assert.Equal(PerfilUsuario.Agente, criado.Usuario.Perfil);
        Assert.True(criado.Usuario.Ativo);
        Assert.True(criado.Usuario.DeveTrocarSenha);
        Assert.Equal(10, criado.SenhaProvisoria.Length);

        var login = await new AuthService(db, Configuracao())
            .LoginAsync(new AuthLoginRequest { Email = "carlos@teste.com", Senha = criado.SenhaProvisoria }, CancellationToken.None);
        Assert.NotNull(login);
        Assert.True(login!.DeveTrocarSenha);
    }

    [Fact]
    public async Task CreateAsync_EmailJaUsado_Lanca()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() =>
            service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = "Outro", Email = "DONO@teste.com" }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_PerfilNenhum_Lanca()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = "X", Email = "x@teste.com", Perfil = PerfilUsuario.Nenhum }, CancellationToken.None));
    }

    [Fact]
    public async Task GetAllAsync_SoTrazUsuariosDaEmpresa()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        var usuarios = await service.GetAllAsync(Empresa, CancellationToken.None);

        Assert.Equal(2, usuarios.Count);
        Assert.DoesNotContain(usuarios, u => u.Email == "estranho@teste.com");
    }

    [Fact]
    public async Task SetAtivoAsync_DesativaEReativaAgente()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        var desativado = await service.SetAtivoAsync(Empresa, DonoId, 101, false, CancellationToken.None);
        Assert.False(desativado.Ativo);

        var reativado = await service.SetAtivoAsync(Empresa, DonoId, 101, true, CancellationToken.None);
        Assert.True(reativado.Ativo);
    }

    [Fact]
    public async Task SetAtivoAsync_DonoNaoSeDesativa()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<RegraUsuarioException>(() =>
            service.SetAtivoAsync(Empresa, DonoId, DonoId, false, CancellationToken.None));
    }

    [Fact]
    public async Task SetAtivoAsync_UltimoDonoAtivoNaoPodeSerDesativadoPorOutroDono()
    {
        await using var db = await Seed();
        // Segundo Dono, inativo: o DonoId continua sendo o único ativo.
        db.Usuarios.Add(new Usuario { Id = 102, Nome = "Socio", Email = "socio@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono, Ativo = false });
        await db.SaveChangesAsync();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<RegraUsuarioException>(() =>
            service.SetAtivoAsync(Empresa, 102, DonoId, false, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_UltimoDonoNaoViraAgente()
    {
        await using var db = await Seed();
        db.Usuarios.Add(new Usuario { Id = 102, Nome = "Socio", Email = "socio@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono, Ativo = false });
        await db.SaveChangesAsync();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<RegraUsuarioException>(() =>
            service.UpdateAsync(Empresa, 102, DonoId, new UsuarioUpdateRequest { Nome = "Dono", Perfil = PerfilUsuario.Agente }, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_PromoveAgenteADono()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        var atualizado = await service.UpdateAsync(Empresa, DonoId, 101, new UsuarioUpdateRequest { Nome = "Carla Souza", Perfil = PerfilUsuario.Dono }, CancellationToken.None);

        Assert.Equal("Carla Souza", atualizado.Nome);
        Assert.Equal(PerfilUsuario.Dono, atualizado.Perfil);
    }

    [Fact]
    public async Task UsuarioDeOutraEmpresa_NaoEncontrado()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SetAtivoAsync(Empresa, DonoId, 200, false, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.RedefinirSenhaAsync(Empresa, 200, CancellationToken.None));
    }

    [Fact]
    public async Task RedefinirSenhaAsync_GeraNovaSenhaEExigeTroca()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db));

        var redefinida = await service.RedefinirSenhaAsync(Empresa, 101, CancellationToken.None);

        Assert.True(redefinida.Usuario.DeveTrocarSenha);
        var login = await new AuthService(db, Configuracao())
            .LoginAsync(new AuthLoginRequest { Email = "carla@teste.com", Senha = redefinida.SenhaProvisoria }, CancellationToken.None);
        Assert.NotNull(login);
    }

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        db.Usuarios.AddRange(
            new Usuario { Id = DonoId, Nome = "Dono", Email = "dono@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono },
            new Usuario { Id = 101, Nome = "Carla", Email = "carla@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Agente },
            new Usuario { Id = 200, Nome = "Estranho", Email = "estranho@teste.com", Senha = "x", EmpresaId = OutraEmpresa, Perfil = PerfilUsuario.Agente });
        await db.SaveChangesAsync();
        return db;
    }

    private static IConfiguration Configuracao() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "dev-secret-micro-erp-tests-2026-key-12345",
                ["Jwt:Issuer"] = "MicroERP.Tests",
                ["Jwt:Audience"] = "MicroERP.Tests"
            })
            .Build();
}
