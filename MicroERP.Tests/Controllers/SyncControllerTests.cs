using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.Controllers;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Controllers;

// A agenda vem na Carga com a mesma regra de GET /api/atendimento/agenda.
public sealed class SyncControllerTests
{
    [Fact]
    public async Task Carga_QuandoAgente_TrazSoAAgendaDele()
    {
        var agenda = new List<AgendaItemResponse> { new() { Id = 10 } };
        var (controller, atendimentos) = BuildController(agenda,
            new Claim("empresaId", "1"),
            new Claim("sub", "5"),
            new Claim("perfil", "Agente"));

        var result = await controller.Carga(null, CancellationToken.None);

        atendimentos.Verify(s => s.GetAgendaAsync(1, null, null, 5L, It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal([10L], Carga(result).Agenda.Select(a => a.Id));
    }

    [Fact]
    public async Task Carga_QuandoDono_TrazAAgendaDeTodos()
    {
        var (controller, atendimentos) = BuildController([],
            new Claim("empresaId", "1"),
            new Claim("sub", "1"),
            new Claim("perfil", "Dono"));

        await controller.Carga(null, CancellationToken.None);

        atendimentos.Verify(s => s.GetAgendaAsync(1, null, null, null, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Carga_SemPerfil_SegueSemAgenda()
    {
        var (controller, atendimentos) = BuildController([new() { Id = 10 }],
            new Claim("empresaId", "1"),
            new Claim("sub", "5")); // sem claim "perfil"

        var result = await controller.Carga(null, CancellationToken.None);

        atendimentos.Verify(s => s.GetAgendaAsync(It.IsAny<long>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Empty(Carga(result).Agenda);
    }

    private static SyncCargaResponse Carga(ActionResult<ApiResponse> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<SyncCargaResponse>(Assert.IsType<ApiResponse>(ok.Value).Data);
    }

    private static (SyncController, Mock<IAtendimentoService>) BuildController(List<AgendaItemResponse> agenda, params Claim[] claims)
    {
        var sync = new Mock<ISyncService>();
        sync.Setup(s => s.CargaAsync(It.IsAny<long>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>(), It.IsAny<bool>()))
            .ReturnsAsync(() => new SyncCargaResponse());
        var atendimentos = new Mock<IAtendimentoService>();
        atendimentos.Setup(s => s.GetAgendaAsync(It.IsAny<long>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(agenda);

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var controller = new SyncController(sync.Object, atendimentos.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
        return (controller, atendimentos);
    }
}
