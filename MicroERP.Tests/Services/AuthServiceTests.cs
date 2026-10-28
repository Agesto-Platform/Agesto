using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_WhenEmailAlreadyExists_ThrowsEmailAlreadyExistsException()
    {
        await using var dbContext = CreateContext();
        dbContext.Usuarios.Add(new Usuario
        {
            Nome = "Existente",
            Email = "existente@teste.com",
            Senha = "hash"
        });
        await dbContext.SaveChangesAsync();

        var service = new AuthService(dbContext, CreateConfiguration());
        var request = new AuthRegisterRequest
        {
            Nome = "Novo",
            Email = "existente@teste.com",
            Senha = "Senha123!"
        };

        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() =>
            service.RegisterAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task RegisterAsync_WhenEmailIsNew_PersistsUserWithHashedPassword()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        var request = new AuthRegisterRequest
        {
            Nome = "Novo Usuario",
            Email = "novo@teste.com",
            Senha = "Senha123!"
        };

        await service.RegisterAsync(request, CancellationToken.None);

        var usuario = await dbContext.Usuarios.SingleAsync(u => u.Email == "novo@teste.com");
        Assert.Equal("Novo Usuario", usuario.Nome);
        Assert.NotEqual("Senha123!", usuario.Senha);
    }

    [Fact]
    public async Task LoginAsync_WhenCredentialsAreValid_ReturnsToken()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        var registerRequest = new AuthRegisterRequest
        {
            Nome = "Login User",
            Email = "login@teste.com",
            Senha = "Senha123!"
        };
        await service.RegisterAsync(registerRequest, CancellationToken.None);

        var response = await service.LoginAsync(new AuthLoginRequest
        {
            Email = "login@teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        Assert.NotNull(response);
        Assert.False(string.IsNullOrWhiteSpace(response!.Token));
    }

    [Fact]
    public async Task LoginAsync_ValidadeDe30Dias_TokenExpiraEm30Dias()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration(expiresMinutes: "43200"));
        await service.RegisterAsync(new AuthRegisterRequest
        {
            Nome = "Agente",
            Email = "agente@teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        var response = await service.LoginAsync(new AuthLoginRequest
        {
            Email = "agente@teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        var esperado = DateTime.UtcNow.AddDays(30);
        Assert.InRange(response!.ExpiresAt, esperado.AddMinutes(-1), esperado.AddMinutes(1));
    }

    [Fact]
    public async Task LoginAsync_WhenPasswordIsWrong_ReturnsNull()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest
        {
            Nome = "Login User",
            Email = "login2@teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        var response = await service.LoginAsync(new AuthLoginRequest
        {
            Email = "login2@teste.com",
            Senha = "Errada123!"
        }, CancellationToken.None);

        Assert.Null(response);
    }

    [Fact]
    public async Task LoginAsync_WhenRegisteredWithMixedCaseEmail_ReturnsToken()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest
        {
            Nome = "Login User",
            Email = "  Joao.Silva@Teste.com ",
            Senha = "Senha123!"
        }, CancellationToken.None);

        var response = await service.LoginAsync(new AuthLoginRequest
        {
            Email = "Joao.Silva@Teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        Assert.NotNull(response);
        var usuario = await dbContext.Usuarios.SingleAsync();
        Assert.Equal("joao.silva@teste.com", usuario.Email);
    }

    [Fact]
    public async Task RegisterAsync_WhenEmailDiffersOnlyByCase_ThrowsEmailAlreadyExistsException()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest
        {
            Nome = "Primeiro",
            Email = "Dono@Teste.com",
            Senha = "Senha123!"
        }, CancellationToken.None);

        await Assert.ThrowsAsync<EmailAlreadyExistsException>(() =>
            service.RegisterAsync(new AuthRegisterRequest
            {
                Nome = "Segundo",
                Email = "dono@teste.com",
                Senha = "Senha123!"
            }, CancellationToken.None));
    }

    [Fact]
    public async Task LoginAsync_WhenUsuarioInativo_ThrowsUsuarioInativoException()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "inativo@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();
        usuario.Ativo = false;
        await dbContext.SaveChangesAsync();

        await Assert.ThrowsAsync<UsuarioInativoException>(() =>
            service.LoginAsync(new AuthLoginRequest { Email = "inativo@teste.com", Senha = "Senha123!" }, CancellationToken.None));
    }

    [Fact]
    public async Task LoginAsync_WhenUsuarioInativoAndPasswordWrong_ReturnsNull()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "inativo2@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();
        usuario.Ativo = false;
        await dbContext.SaveChangesAsync();

        Assert.Null(await service.LoginAsync(new AuthLoginRequest { Email = "inativo2@teste.com", Senha = "Errada123!" }, CancellationToken.None));
    }

    [Fact]
    public async Task LoginAsync_RegistraUltimoAcessoEDevolveDeveTrocarSenha()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "acesso@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();
        usuario.DeveTrocarSenha = true;
        await dbContext.SaveChangesAsync();

        var response = await service.LoginAsync(new AuthLoginRequest { Email = "acesso@teste.com", Senha = "Senha123!" }, CancellationToken.None);

        Assert.True(response!.DeveTrocarSenha);
        Assert.NotNull((await dbContext.Usuarios.SingleAsync()).UltimoAcessoEm);
    }

    [Fact]
    public async Task LoginAsync_SemTermosConfigurados_NaoPedeAceite()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "semtermos@teste.com", Senha = "Senha123!" }, CancellationToken.None);

        var response = await service.LoginAsync(new AuthLoginRequest { Email = "semtermos@teste.com", Senha = "Senha123!" }, CancellationToken.None);

        Assert.False(response!.DeveAceitarTermos);
        Assert.Null(response.Termos);
    }

    [Fact]
    public async Task AceitarTermosAsync_VersaoVigente_RegistraEParaDePedir()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, ConfiguracaoComTermos("2026-11"));
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Agente", Email = "termos@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var login = new AuthLoginRequest { Email = "termos@teste.com", Senha = "Senha123!" };

        var antes = await service.LoginAsync(login, CancellationToken.None);
        Assert.True(antes!.DeveAceitarTermos);
        Assert.Equal("2026-11", antes.Termos!.Versao);
        Assert.Equal("https://agesto.com.br/termos", antes.Termos.UrlTermos);
        Assert.Equal("https://agesto.com.br/privacidade", antes.Termos.UrlPrivacidade);

        var usuario = await dbContext.Usuarios.SingleAsync();
        await service.AceitarTermosAsync(usuario.Id, new AceitarTermosRequest { Versao = "2026-11" }, CancellationToken.None);

        var salvo = await dbContext.Usuarios.SingleAsync();
        Assert.Equal("2026-11", salvo.TermosVersaoAceita);
        Assert.NotNull(salvo.TermosAceitosEm);
        var depois = await service.LoginAsync(login, CancellationToken.None);
        Assert.False(depois!.DeveAceitarTermos);
        Assert.Null(depois.Termos);
    }

    [Fact]
    public async Task LoginAsync_VersaoNovaDosTermos_PedeAceiteDeNovo()
    {
        await using var dbContext = CreateContext();
        var antiga = new AuthService(dbContext, ConfiguracaoComTermos("2026-11"));
        await antiga.RegisterAsync(new AuthRegisterRequest { Nome = "Agente", Email = "nova@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();
        await antiga.AceitarTermosAsync(usuario.Id, new AceitarTermosRequest { Versao = "2026-11" }, CancellationToken.None);

        var nova = new AuthService(dbContext, ConfiguracaoComTermos("2027-01"));
        var response = await nova.LoginAsync(new AuthLoginRequest { Email = "nova@teste.com", Senha = "Senha123!" }, CancellationToken.None);

        Assert.True(response!.DeveAceitarTermos);
        Assert.Equal("2027-01", response.Termos!.Versao);
    }

    [Theory]
    [InlineData("2026-10")]
    [InlineData("")]
    public async Task AceitarTermosAsync_VersaoDiferenteDaVigente_Lanca(string versao)
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, ConfiguracaoComTermos("2026-11"));
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Agente", Email = "velha@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AceitarTermosAsync(usuario.Id, new AceitarTermosRequest { Versao = versao }, CancellationToken.None));
        Assert.Null((await dbContext.Usuarios.SingleAsync()).TermosVersaoAceita);
    }

    [Fact]
    public async Task AceitarTermosAsync_SemTermosConfigurados_Lanca()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Agente", Email = "nada@teste.com", Senha = "Senha123!" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.AceitarTermosAsync(usuario.Id, new AceitarTermosRequest { Versao = "2026-11" }, CancellationToken.None));
    }

    private static IConfiguration ConfiguracaoComTermos(string versao) =>
        new ConfigurationBuilder()
            .AddConfiguration(CreateConfiguration())
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Termos:Versao"] = versao,
                ["Termos:UrlTermos"] = "https://agesto.com.br/termos",
                ["Termos:UrlPrivacidade"] = "https://agesto.com.br/privacidade"
            })
            .Build();

    [Fact]
    public async Task TrocarSenhaAsync_ComSenhaAtualCorreta_TrocaELimpaPendencia()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "troca@teste.com", Senha = "Provisoria1" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();
        usuario.DeveTrocarSenha = true;
        await dbContext.SaveChangesAsync();

        await service.TrocarSenhaAsync(usuario.Id, new TrocarSenhaRequest { SenhaAtual = "Provisoria1", NovaSenha = "NovaSenha2" }, CancellationToken.None);

        Assert.False((await dbContext.Usuarios.SingleAsync()).DeveTrocarSenha);
        Assert.Null(await service.LoginAsync(new AuthLoginRequest { Email = "troca@teste.com", Senha = "Provisoria1" }, CancellationToken.None));
        Assert.NotNull(await service.LoginAsync(new AuthLoginRequest { Email = "troca@teste.com", Senha = "NovaSenha2" }, CancellationToken.None));
    }

    [Fact]
    public async Task TrocarSenhaAsync_ComSenhaAtualErrada_Lanca()
    {
        await using var dbContext = CreateContext();
        var service = new AuthService(dbContext, CreateConfiguration());
        await service.RegisterAsync(new AuthRegisterRequest { Nome = "Dono", Email = "troca2@teste.com", Senha = "Provisoria1" }, CancellationToken.None);
        var usuario = await dbContext.Usuarios.SingleAsync();

        await Assert.ThrowsAsync<SenhaAtualInvalidaException>(() =>
            service.TrocarSenhaAsync(usuario.Id, new TrocarSenhaRequest { SenhaAtual = "Errada0000", NovaSenha = "NovaSenha2" }, CancellationToken.None));
    }

    private static IConfiguration CreateConfiguration(string expiresMinutes = "120")
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "dev-secret-micro-erp-tests-2026-key-12345",
                ["Jwt:Issuer"] = "MicroERP.Tests",
                ["Jwt:Audience"] = "MicroERP.Tests",
                ["Jwt:ExpiresMinutes"] = expiresMinutes
            })
            .Build();
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new AppDbContext(options);
    }
}
