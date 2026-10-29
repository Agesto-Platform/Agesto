using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.Controllers;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Controllers;

public sealed class PaginacaoControllerTests
{
    [Fact]
    public async Task GetAll_SemPaginacao_DevolveAListaInteiraComoAntes()
    {
        var svc = new Mock<IClienteService>();
        svc.Setup(s => s.GetAllAsync(1, It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<ClienteResponse> { new() { Id = 1 } });

        var result = await BuildController(svc).GetAll(new PaginacaoQuery(), CancellationToken.None);

        var body = Assert.IsType<ApiResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        Assert.IsAssignableFrom<IReadOnlyList<ClienteResponse>>(body.Data);
        svc.Verify(s => s.GetPaginaAsync(It.IsAny<long>(), It.IsAny<PaginacaoQuery>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAll_ComPaginacao_DevolveAPagina()
    {
        var svc = new Mock<IClienteService>();
        svc.Setup(s => s.GetPaginaAsync(1, It.IsAny<PaginacaoQuery>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(new PaginaResponse<ClienteResponse> { Pagina = 2, Tamanho = 20, Total = 41 });

        var result = await BuildController(svc).GetAll(new PaginacaoQuery { Pagina = 2 }, CancellationToken.None);

        var body = Assert.IsType<ApiResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        var pagina = Assert.IsType<PaginaResponse<ClienteResponse>>(body.Data);
        Assert.Equal(41, pagina.Total);
        svc.Verify(s => s.GetAllAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(null, 0)]
    [InlineData(null, 101)]
    public void PaginacaoQuery_ForaDosLimites_EhInvalida(int? pagina, int? tamanho)
    {
        var query = new PaginacaoQuery { Pagina = pagina, Tamanho = tamanho };
        Assert.False(Validator.TryValidateObject(query, new ValidationContext(query), [], validateAllProperties: true));
    }

    [Fact]
    public void PaginacaoQuery_SoTamanho_UsaPrimeiraPagina()
    {
        var query = new PaginacaoQuery { Tamanho = 50 };
        Assert.True(query.Informada);
        Assert.Equal(1, query.PaginaOuPadrao);
        Assert.Equal(50, query.TamanhoOuPadrao);
    }

    private static ClienteController BuildController(Mock<IClienteService> svc)
    {
        var identity = new ClaimsIdentity([new Claim("empresaId", "1"), new Claim("sub", "1"), new Claim("perfil", "Dono")], "TestAuth");
        return new ClienteController(svc.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }
}
