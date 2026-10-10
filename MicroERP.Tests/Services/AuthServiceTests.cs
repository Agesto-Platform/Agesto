using Microsoft.EntityFrameworkCore;
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

    private static IConfiguration CreateConfiguration()
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "dev-secret-micro-erp-tests-2026-key-12345",
                ["Jwt:Issuer"] = "MicroERP.Tests",
                ["Jwt:Audience"] = "MicroERP.Tests",
                ["Jwt:ExpiresMinutes"] = "120"
            })
            .Build();
    }

    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }
}
