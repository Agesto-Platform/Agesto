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
    public async Task CreateAsync_CriaAcessoComConvitePendenteESemSenhaConhecida()
    {
        await using var db = await Seed();
        var convites = new ConvitesFalsos();
        var service = new UsuarioService(new UsuarioRepository(db), convites);

        var criado = await service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = " Carlos ", Email = " Carlos@Teste.com " }, CancellationToken.None);

        Assert.Equal("Carlos", criado.Usuario.Nome);
        Assert.Equal("carlos@teste.com", criado.Usuario.Email);
        Assert.Equal(PerfilUsuario.Agente, criado.Usuario.Perfil);
        Assert.True(criado.Usuario.Ativo);
        Assert.True(criado.Usuario.ConvitePendente);
        Assert.False(criado.Usuario.DeveTrocarSenha);
        Assert.True(criado.EnvioHabilitado);
        Assert.Equal(["carlos@teste.com"], convites.Usuarios.Select(u => u.Email));

        var carlos = await db.Usuarios.SingleAsync(u => u.Email == "carlos@teste.com");
        Assert.Null(carlos.EmailConfirmadoEm);
        Assert.Equal(Empresa, carlos.EmpresaId);
    }

    [Fact]
    public async Task CreateAsync_EmailJaUsado_Lanca()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() =>
            service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = "Outro", Email = "DONO@teste.com" }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_PerfilNenhum_Lanca()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.CreateAsync(Empresa, new UsuarioCreateRequest { Nome = "X", Email = "x@teste.com", Perfil = PerfilUsuario.Nenhum }, CancellationToken.None));
    }

    [Fact]
    public async Task ReenviarConvite_SoParaQuemAindaNaoCriouASenhaEEstaAtivo()
    {
        await using var db = await Seed();
        var convites = new ConvitesFalsos();
        var service = new UsuarioService(new UsuarioRepository(db), convites);

        // Carla (101) está com o convite pendente; o Dono já criou a senha.
        var reenviado = await service.ReenviarConviteAsync(Empresa, 101, CancellationToken.None);
        Assert.Equal("carla@teste.com", reenviado.Usuario.Email);
        Assert.Single(convites.Usuarios);

        await Assert.ThrowsAsync<RegraUsuarioException>(() => service.ReenviarConviteAsync(Empresa, DonoId, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.ReenviarConviteAsync(Empresa, 200, CancellationToken.None));

        await service.SetAtivoAsync(Empresa, DonoId, 101, false, CancellationToken.None);
        await Assert.ThrowsAsync<RegraUsuarioException>(() => service.ReenviarConviteAsync(Empresa, 101, CancellationToken.None));
    }

    [Fact]
    public async Task GetAllAsync_SoTrazUsuariosDaEmpresa_ComOConvitePendente()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        var usuarios = await service.GetAllAsync(Empresa, CancellationToken.None);

        Assert.Equal(2, usuarios.Count);
        Assert.DoesNotContain(usuarios, u => u.Email == "estranho@teste.com");
        Assert.False(usuarios.Single(u => u.Id == DonoId).ConvitePendente);
        Assert.True(usuarios.Single(u => u.Id == 101).ConvitePendente);
    }

    [Fact]
    public async Task SetAtivoAsync_DesativaEReativaAgente()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        var desativado = await service.SetAtivoAsync(Empresa, DonoId, 101, false, CancellationToken.None);
        Assert.False(desativado.Ativo);

        var reativado = await service.SetAtivoAsync(Empresa, DonoId, 101, true, CancellationToken.None);
        Assert.True(reativado.Ativo);
    }

    [Fact]
    public async Task SetAtivoAsync_DonoNaoSeDesativa()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

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
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<RegraUsuarioException>(() =>
            service.SetAtivoAsync(Empresa, 102, DonoId, false, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_UltimoDonoNaoViraAgente()
    {
        await using var db = await Seed();
        db.Usuarios.Add(new Usuario { Id = 102, Nome = "Socio", Email = "socio@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono, Ativo = false });
        await db.SaveChangesAsync();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<RegraUsuarioException>(() =>
            service.UpdateAsync(Empresa, 102, DonoId, new UsuarioUpdateRequest { Nome = "Dono", Perfil = PerfilUsuario.Agente }, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_PromoveAgenteADono()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        var atualizado = await service.UpdateAsync(Empresa, DonoId, 101, new UsuarioUpdateRequest { Nome = "Carla Souza", Perfil = PerfilUsuario.Dono }, CancellationToken.None);

        Assert.Equal("Carla Souza", atualizado.Nome);
        Assert.Equal(PerfilUsuario.Dono, atualizado.Perfil);
    }

    [Fact]
    public async Task UsuarioDeOutraEmpresa_NaoEncontrado()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SetAtivoAsync(Empresa, DonoId, 200, false, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_AnonimizaEMarcaDeletedAtSemApagarALinha()
    {
        await using var db = await Seed();
        db.Atendimentos.Add(new Atendimento { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = Empresa, ClienteId = 1, UsuarioId = 101 });
        await db.SaveChangesAsync();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        Assert.True(await service.DeleteAsync(101, Empresa, CancellationToken.None));

        var carla = await db.Usuarios.SingleAsync(u => u.Id == 101);
        Assert.NotNull(carla.DeletedAt);
        Assert.False(carla.Ativo);
        Assert.Equal(DadosPessoais.NomeUsuarioAnonimizado, carla.Nome);
        Assert.Equal(DadosPessoais.EmailAnonimizado(101), carla.Email);
        // o histórico continua apontando para a linha
        Assert.Equal(101, (await db.Atendimentos.SingleAsync()).UsuarioId);
    }

    [Fact]
    public async Task DeleteAsync_ContaRemovidaNaoEntraESomeDaLista()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());
        var carla = await db.Usuarios.SingleAsync(u => u.Id == 101);
        carla.Senha = new Microsoft.AspNetCore.Identity.PasswordHasher<Usuario>().HashPassword(carla, "SenhaDaCarla1");
        await db.SaveChangesAsync();

        await service.DeleteAsync(101, Empresa, CancellationToken.None);

        var login = await new AuthService(db, Configuracao())
            .LoginAsync(new AuthLoginRequest { Email = "carla@teste.com", Senha = "SenhaDaCarla1" }, CancellationToken.None);
        Assert.Null(login);
        Assert.DoesNotContain(await service.GetAllAsync(Empresa, CancellationToken.None), u => u.Id == 101);
        await Assert.ThrowsAsync<NotFoundException>(() => service.SetAtivoAsync(Empresa, DonoId, 101, true, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_LiberaOEmailParaNovoCadastro()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await service.DeleteAsync(101, Empresa, CancellationToken.None);

        Assert.False(await new UsuarioRepository(db).EmailExistsAsync("carla@teste.com", CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_UltimoDonoAtivo_Bloqueia()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        await Assert.ThrowsAsync<UltimoDonoDaEmpresaException>(() => service.DeleteAsync(DonoId, Empresa, CancellationToken.None));
        Assert.Null((await db.Usuarios.SingleAsync(u => u.Id == DonoId)).DeletedAt);
    }

    [Fact]
    public async Task DeleteAsync_DonoInativoNaoContaComoDonoQueSobra()
    {
        await using var db = await Seed();
        db.Usuarios.Add(new Usuario { Id = 102, Nome = "Dono inativo", Email = "inativo@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono, Ativo = false });
        await db.SaveChangesAsync();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        // antes a regra contava Donos inativos e deixaria a empresa sem Dono ativo
        await Assert.ThrowsAsync<UltimoDonoDaEmpresaException>(() => service.DeleteAsync(DonoId, Empresa, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_OutraEmpresa_NaoEncontra()
    {
        await using var db = await Seed();
        var service = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos());

        Assert.False(await service.DeleteAsync(200, Empresa, CancellationToken.None));
        Assert.Null((await db.Usuarios.SingleAsync(u => u.Id == 200)).DeletedAt);
    }

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        db.Usuarios.AddRange(
            new Usuario { Id = DonoId, Nome = "Dono", Email = "dono@teste.com", Senha = "x", EmpresaId = Empresa, Perfil = PerfilUsuario.Dono, EmailConfirmadoEm = DateTime.UtcNow },
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
