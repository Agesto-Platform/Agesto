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

    // Os testes antigos entram só com a senha; os da verificação em duas etapas ligam doisFatores.
    private static AdminAuthService Auth(
        AppDbContext db, ConvitesFalsos? convites = null, string? setupKey = ChaveSetup,
        CodigosFalsos? codigos = null, bool doisFatores = false) =>
        new(db, Config(setupKey, doisFatores), convites ?? new ConvitesFalsos(), codigos ?? new CodigosFalsos());

    private static AdminEmpresaService Empresas(AppDbContext db, ConvitesFalsos? convites = null) =>
        new(db, new AuthService(db, Config()), convites ?? new ConvitesFalsos(), new AssinaturaService(db, TimeProvider.System), TimeProvider.System);

    [Fact]
    public async Task Setup_CriaPrimeiroAdminSoComAChaveCertaEUmaVez()
    {
        await using var db = CreateContext();
        var service = Auth(db);
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
        var service = Auth(db, setupKey: null);

        var ex = await Assert.ThrowsAsync<AdminSetupException>(() => service.SetupAsync(
            new AdminCriarRequest { Nome = "Equipe", Email = "equipe@agesto.com", Senha = "senha-bem-longa-123" },
            "qualquer", null, CancellationToken.None));
        Assert.Equal(404, ex.StatusCode);
    }

    [Fact]
    public async Task Login_TokenDeAdminTemAudienciaPropriaENaoTemEmpresa()
    {
        await using var db = CreateContext();
        var service = Auth(db);
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

        // DEC-53: sem Admin:ExpiresMinutes, o login de admin vale 24 horas.
        Assert.InRange(ok.ExpiresAt - DateTime.UtcNow, TimeSpan.FromHours(23.9), TimeSpan.FromHours(24));
    }

    [Fact]
    public async Task DesativarAdmin_CortaOAcessoMasNinguemSeDesativaSozinho()
    {
        await using var db = CreateContext();
        var service = Auth(db);
        var eu = await service.SetupAsync(new AdminCriarRequest { Nome = "Eu", Email = "eu@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None);
        await service.ConvidarAsync(eu.Id, new AdminConvidarRequest { Nome = "Saiu", Email = "saiu@agesto.com" }, null, CancellationToken.None);
        var outro = await db.AdminsPlataforma.SingleAsync(a => a.Email == "saiu@agesto.com");
        outro.Senha = new PasswordHasher<AdminPlataforma>().HashPassword(outro, "senha-bem-longa-456");
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.DefinirAtivoAsync(eu.Id, eu.Id, false, null, CancellationToken.None));

        await service.DefinirAtivoAsync(eu.Id, outro.Id, false, null, CancellationToken.None);
        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "saiu@agesto.com", Senha = "senha-bem-longa-456" }, null, CancellationToken.None));
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "desativar-admin" && a.Detalhes == "saiu@agesto.com");
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "login-falhou" && a.AdminId == outro.Id);
    }

    [Fact]
    public async Task ConvidarAdmin_NasceSemSenhaConhecidaERecebeOConvite()
    {
        await using var db = CreateContext();
        var convites = new ConvitesFalsos();
        var service = Auth(db, convites);
        var eu = await service.SetupAsync(new AdminCriarRequest { Nome = "Eu", Email = "eu@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None);

        var convite = await service.ConvidarAsync(eu.Id, new AdminConvidarRequest { Nome = "Nova", Email = " Nova@Agesto.com " }, null, CancellationToken.None);

        Assert.Equal("nova@agesto.com", convite.Email);
        Assert.Equal(["nova@agesto.com"], convites.Admins.Select(a => a.Email));
        var lista = await service.ListarAsync(CancellationToken.None);
        Assert.False(lista.Single(a => a.Email == "eu@agesto.com").ConvitePendente);
        Assert.True(lista.Single(a => a.Email == "nova@agesto.com").ConvitePendente);
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "convidar-admin");

        // Reenviar só vale para quem ainda não criou a senha.
        var nova = lista.Single(a => a.Email == "nova@agesto.com");
        await service.ReenviarConviteAsync(eu.Id, nova.Id, null, CancellationToken.None);
        Assert.Equal(2, convites.Admins.Count);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.ReenviarConviteAsync(eu.Id, eu.Id, null, CancellationToken.None));
        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() =>
            service.ConvidarAsync(eu.Id, new AdminConvidarRequest { Nome = "De novo", Email = "nova@agesto.com" }, null, CancellationToken.None));
    }

    [Fact]
    public async Task Login_AdminDesativado_NaoEntra()
    {
        await using var db = CreateContext();
        var admin = new AdminPlataforma { Nome = "Ex", Email = "ex@agesto.com", Ativo = false };
        admin.Senha = new PasswordHasher<AdminPlataforma>().HashPassword(admin, "senha-bem-longa-123");
        db.AdminsPlataforma.Add(admin);
        await db.SaveChangesAsync();

        var service = Auth(db);
        Assert.Null(await service.LoginAsync(new AdminLoginRequest { Email = "ex@agesto.com", Senha = "senha-bem-longa-123" }, null, CancellationToken.None));
    }

    [Fact]
    public async Task CriarEmpresa_CriaDonoComConvitePendenteEAudita()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        var convites = new ConvitesFalsos();
        var service = Empresas(db, convites);

        var criada = await service.CriarAsync(adminId,
            new EmpresaAdminCriarRequest { NomeEmpresa = "Clima Frio", NomeDono = "Ana", EmailDono = "ANA@clima.com" },
            null, CancellationToken.None);

        var dono = await db.Usuarios.SingleAsync();
        Assert.Equal("ana@clima.com", dono.Email);
        Assert.Equal(PerfilUsuario.Dono, dono.Perfil);
        Assert.Null(dono.EmailConfirmadoEm);
        Assert.False(dono.DeveTrocarSenha);
        Assert.Equal(criada.EmpresaId, dono.EmpresaId);
        Assert.True(criada.EnvioHabilitado);
        Assert.Equal(["ana@clima.com"], convites.Usuarios.Select(u => u.Email));
        Assert.Single(db.Configuracoes.Where(c => c.EmpresaId == criada.EmpresaId));
        Assert.Equal(criada.EmpresaId, (await db.AuditoriasAdmin.SingleAsync(a => a.Acao == "criar-empresa")).EmpresaId);
    }

    [Fact]
    public async Task CriarUsuario_SoPelaEquipe_NasceComConvitePendente()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        db.Empresas.Add(new Empresa { Id = 5, Nome = "Refrigeração" });
        db.Usuarios.Add(new Usuario { Id = 50, Nome = "Dono", Email = "dono@refri.com", Senha = "hash", EmpresaId = 5, Perfil = PerfilUsuario.Dono });
        await db.SaveChangesAsync();
        var convites = new ConvitesFalsos();
        var service = Empresas(db, convites);

        var convite = await service.CriarUsuarioAsync(adminId, 5,
            new UsuarioCreateRequest { Nome = " Carlos ", Email = " Carlos@Refri.com ", Perfil = PerfilUsuario.Agente }, null, CancellationToken.None);

        var carlos = await db.Usuarios.SingleAsync(u => u.Email == "carlos@refri.com");
        Assert.Equal("Carlos", carlos.Nome);
        Assert.Equal(5, carlos.EmpresaId);
        Assert.Equal(PerfilUsuario.Agente, carlos.Perfil);
        Assert.Null(carlos.EmailConfirmadoEm);
        Assert.Equal("carlos@refri.com", convite.Email);
        Assert.Equal(["carlos@refri.com"], convites.Usuarios.Select(u => u.Email));
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "criar-usuario" && a.UsuarioId == carlos.Id);
        Assert.True((await service.ObterAsync(5, CancellationToken.None)).Usuarios.Single(u => u.Id == carlos.Id).ConvitePendente);

        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() => service.CriarUsuarioAsync(adminId, 5,
            new UsuarioCreateRequest { Nome = "Outro", Email = "DONO@refri.com" }, null, CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() => service.CriarUsuarioAsync(adminId, 5,
            new UsuarioCreateRequest { Nome = "X", Email = "x@refri.com", Perfil = PerfilUsuario.Nenhum }, null, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.CriarUsuarioAsync(adminId, 999,
            new UsuarioCreateRequest { Nome = "Y", Email = "y@refri.com" }, null, CancellationToken.None));
    }

    [Fact]
    public async Task BloquearEDesbloquear_MudamAEmpresaEAuditam()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        db.Empresas.Add(new Empresa { Id = 7, Nome = "Inadimplente" });
        await db.SaveChangesAsync();
        var service = Empresas(db);

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
        var convites = new ConvitesFalsos();
        var service = Empresas(db, convites);

        await Assert.ThrowsAsync<NotFoundException>(() => service.DefinirUsuarioAtivoAsync(adminId, 1, 20, false, null, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.EnviarLinkSenhaAsync(adminId, 1, 20, null, CancellationToken.None));

        await service.DefinirUsuarioAtivoAsync(adminId, 2, 20, false, null, CancellationToken.None);
        Assert.False((await db.Usuarios.SingleAsync()).Ativo);
        // Desativado não recebe link; reativado, sim.
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.EnviarLinkSenhaAsync(adminId, 2, 20, null, CancellationToken.None));

        await service.DefinirUsuarioAtivoAsync(adminId, 2, 20, true, null, CancellationToken.None);
        var envio = await service.EnviarLinkSenhaAsync(adminId, 2, 20, null, CancellationToken.None);
        Assert.Equal("bia@b.com", envio.Email);
        Assert.Equal(["bia@b.com"], convites.Usuarios.Select(u => u.Email));
        // A senha atual continua valendo até a pessoa usar o link.
        Assert.Equal("hash", (await db.Usuarios.SingleAsync()).Senha);
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "reenviar-convite" && a.UsuarioId == 20);
    }

    [Fact]
    public async Task UsuarioRemovidoPelaLgpd_NaoApareceNemPodeSerAlterado()
    {
        await using var db = CreateContext();
        var adminId = await SeedAdmin(db);
        db.Empresas.Add(new Empresa { Id = 3, Nome = "Loja" });
        db.Usuarios.AddRange(
            new Usuario { Id = 30, Nome = "Dono", Email = "dono@loja.com", Senha = "hash", EmpresaId = 3, Perfil = PerfilUsuario.Dono },
            new Usuario { Id = 31, Nome = "Usuário removido", Email = "removido-31@anonimo.invalid", Senha = "hash", EmpresaId = 3,
                Perfil = PerfilUsuario.Agente, Ativo = false, DeletedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = Empresas(db);

        var detalhe = await service.ObterAsync(3, CancellationToken.None);
        Assert.Equal([30L], detalhe.Usuarios.Select(u => u.Id));

        await Assert.ThrowsAsync<NotFoundException>(() => service.DefinirUsuarioAtivoAsync(adminId, 3, 31, true, null, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.EnviarLinkSenhaAsync(adminId, 3, 31, null, CancellationToken.None));
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

    // --- Bloqueio por conta e verificação em duas etapas (DEC-52) ---

    private static async Task<(AdminAuthService Servico, CodigosFalsos Codigos)> AdminCom2fa(AppDbContext db)
    {
        var codigos = new CodigosFalsos();
        var servico = Auth(db, codigos: codigos, doisFatores: true);
        await servico.SetupAsync(new AdminCriarRequest { Nome = "Equipe", Email = "equipe@agesto.com", Senha = "senha-bem-longa-123" },
            ChaveSetup, null, CancellationToken.None);
        return (servico, codigos);
    }

    private static AdminLoginRequest Senha(string senha = "senha-bem-longa-123") => new() { Email = "equipe@agesto.com", Senha = senha };

    [Fact]
    public async Task Login_CincoSenhasErradas_BloqueiaMesmoComASenhaCerta()
    {
        await using var db = CreateContext();
        var (servico, _) = await AdminCom2fa(db);

        for (var i = 0; i < 4; i++)
            Assert.Null(await servico.LoginAsync(Senha("errada"), null, CancellationToken.None));
        await Assert.ThrowsAsync<ContaBloqueadaException>(() => servico.LoginAsync(Senha("errada"), null, CancellationToken.None));
        await Assert.ThrowsAsync<ContaBloqueadaException>(() => servico.LoginAsync(Senha(), null, CancellationToken.None));

        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "conta-bloqueada");
    }

    [Fact]
    public async Task Login_ComDoisFatores_PedeOCodigoEOCodigoCertoEntra()
    {
        await using var db = CreateContext();
        var (servico, codigos) = await AdminCom2fa(db);

        var primeira = await servico.LoginAsync(Senha(), null, CancellationToken.None);

        Assert.NotNull(primeira);
        Assert.True(primeira!.ExigeCodigo);
        Assert.Equal(string.Empty, primeira.Token);
        Assert.Equal("eq***@agesto.com", primeira.EmailMascarado);
        var (para, codigo) = Assert.Single(codigos.Enviados);
        Assert.Equal("equipe@agesto.com", para);
        Assert.Matches("^[0-9]{6}$", codigo);
        // O banco guarda só os hashes.
        var admin = db.AdminsPlataforma.Single();
        Assert.DoesNotContain(codigo, admin.CodigoLoginHash);

        var final = await servico.ConfirmarCodigoAsync(new AdminCodigoRequest { Desafio = primeira.Desafio!, Codigo = codigo }, null, CancellationToken.None);
        Assert.NotNull(final);
        Assert.False(string.IsNullOrEmpty(final!.Token));

        // Uso único: o mesmo código não entra de novo.
        Assert.Null(await servico.ConfirmarCodigoAsync(new AdminCodigoRequest { Desafio = primeira.Desafio!, Codigo = codigo }, null, CancellationToken.None));
    }

    [Fact]
    public async Task ConfirmarCodigo_CodigoDeOutroLoginOuErradoNaoEntra_ECincoErrosInvalidam()
    {
        await using var db = CreateContext();
        var (servico, codigos) = await AdminCom2fa(db);
        var primeira = await servico.LoginAsync(Senha(), null, CancellationToken.None);
        var codigo = codigos.Enviados[^1].Codigo;
        var errado = codigo == "000000" ? "111111" : "000000";

        // Desafio inventado não serve.
        Assert.Null(await servico.ConfirmarCodigoAsync(new AdminCodigoRequest { Desafio = "inventado", Codigo = codigo }, null, CancellationToken.None));

        for (var i = 0; i < AdminAuthService.TentativasDeCodigo; i++)
            Assert.Null(await servico.ConfirmarCodigoAsync(new AdminCodigoRequest { Desafio = primeira!.Desafio!, Codigo = errado }, null, CancellationToken.None));

        // Depois de 5 erros, nem o código certo serve: precisa entrar de novo com a senha.
        Assert.Null(await servico.ConfirmarCodigoAsync(new AdminCodigoRequest { Desafio = primeira!.Desafio!, Codigo = codigo }, null, CancellationToken.None));
        Assert.Null(db.AdminsPlataforma.Single().DesafioLoginHash);
    }

    [Fact]
    public async Task ConfirmarCodigo_Expirado_NaoEntra()
    {
        await using var db = CreateContext();
        var (servico, codigos) = await AdminCom2fa(db);
        var primeira = await servico.LoginAsync(Senha(), null, CancellationToken.None);
        db.AdminsPlataforma.Single().CodigoLoginExpiraEm = DateTime.UtcNow.AddMinutes(-1);
        await db.SaveChangesAsync();

        Assert.Null(await servico.ConfirmarCodigoAsync(
            new AdminCodigoRequest { Desafio = primeira!.Desafio!, Codigo = codigos.Enviados[^1].Codigo }, null, CancellationToken.None));
    }

    [Fact]
    public async Task Login_NovoLoginInvalidaOCodigoAnterior()
    {
        await using var db = CreateContext();
        var (servico, codigos) = await AdminCom2fa(db);
        var primeira = await servico.LoginAsync(Senha(), null, CancellationToken.None);
        var codigoAntigo = codigos.Enviados[^1].Codigo;
        await servico.LoginAsync(Senha(), null, CancellationToken.None);

        Assert.Null(await servico.ConfirmarCodigoAsync(
            new AdminCodigoRequest { Desafio = primeira!.Desafio!, Codigo = codigoAntigo }, null, CancellationToken.None));
    }

    [Fact]
    public void MascararEmail_EscondeOMeioDoNome()
    {
        Assert.Equal("da***@gmail.com", AdminAuthService.MascararEmail("davi@gmail.com"));
        Assert.Equal("a***@x.com", AdminAuthService.MascararEmail("a@x.com"));
    }

    private static IConfiguration Config(string? setupKey = ChaveSetup, bool doisFatores = false) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"] = "uma-chave-de-teste-com-pelo-menos-32-bytes!!",
            ["Jwt:Issuer"] = "MicroERP.Api",
            ["Jwt:Audience"] = "MicroERP.Api",
            ["Admin:SetupKey"] = setupKey,
            ["Admin:DoisFatores"] = doisFatores ? "true" : "false",
        }).Build();

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
}
