using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using MicroERP.Api.Controllers;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Tests.Controllers;

public sealed class AuthControllerTests
{
    private static readonly AuthRegisterRequest Request = new()
    {
        NomeEmpresa = "Empresa",
        Nome = "Dono",
        Email = "dono@teste.com",
        Senha = "Senha123!"
    };

    [Fact]
    public async Task Register_SemChaveConfigurada_RetornaNotFound()
    {
        var auth = new Mock<IAuthService>();
        var controller = new AuthController(auth.Object, Config(null));

        var result = await controller.Register(Request, "qualquer", CancellationToken.None);

        Assert.IsType<NotFoundResult>(result);
        auth.Verify(a => a.RegisterAsync(It.IsAny<AuthRegisterRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("chave-errada")]
    public async Task Register_ChaveAusenteOuErrada_RetornaForbidden(string? enviada)
    {
        var auth = new Mock<IAuthService>();
        var controller = new AuthController(auth.Object, Config("chave-certa"));

        var result = await controller.Register(Request, enviada, CancellationToken.None);

        Assert.Equal(403, Assert.IsType<ObjectResult>(result).StatusCode);
        auth.Verify(a => a.RegisterAsync(It.IsAny<AuthRegisterRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Register_ChaveCorreta_Cadastra()
    {
        var auth = new Mock<IAuthService>();
        var controller = new AuthController(auth.Object, Config("chave-certa"));

        var result = await controller.Register(Request, "chave-certa", CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        auth.Verify(a => a.RegisterAsync(Request, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static IConfiguration Config(string? chave) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Auth:RegistrationKey"] = chave })
            .Build();
}
