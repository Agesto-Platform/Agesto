using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.Controllers;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Controllers;

public sealed class AtendimentoControllerTests
{
    [Fact]
    public async Task GetAgenda_QuandoAgente_ForcaProprioIdIgnorandoAgenteIdDaQuery()
    {
        var svc = new Mock<IAtendimentoService>();
        svc.Setup(s => s.GetAgendaAsync(1, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<long?>(), false, It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<AgendaItemResponse>());

        var controller = BuildController(svc,
            new Claim("empresaId", "1"),
            new Claim("sub", "5"),
            new Claim("perfil", "Agente"));

        // Agente malicioso tenta ver a agenda do agente 99
        await controller.GetAgenda(null, null, agenteId: 99, historico: false, CancellationToken.None);

        // O filtro deve ser forcado para o proprio usuario (5), nunca 99.
        svc.Verify(s => s.GetAgendaAsync(1, null, null, 5L, false, It.IsAny<CancellationToken>()), Times.Once);
        svc.Verify(s => s.GetAgendaAsync(1, null, null, 99L, false, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAgenda_QuandoDono_UsaAgenteIdDaQuery()
    {
        var svc = new Mock<IAtendimentoService>();
        svc.Setup(s => s.GetAgendaAsync(1, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<long?>(), false, It.IsAny<CancellationToken>()))
           .ReturnsAsync(new List<AgendaItemResponse>());

        var controller = BuildController(svc,
            new Claim("empresaId", "1"),
            new Claim("sub", "1"),
            new Claim("perfil", "Dono"));

        await controller.GetAgenda(null, null, agenteId: 7, historico: false, CancellationToken.None);

        svc.Verify(s => s.GetAgendaAsync(1, null, null, 7L, false, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetAgenda_SemClaimDePerfil_Retorna401ENaoConsultaServico()
    {
        var svc = new Mock<IAtendimentoService>();

        var controller = BuildController(svc,
            new Claim("empresaId", "1"),
            new Claim("sub", "5")); // sem claim "perfil"

        var result = await controller.GetAgenda(null, null, agenteId: 99, historico: false, CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
        svc.Verify(s => s.GetAgendaAsync(It.IsAny<long>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<long?>(), false, It.IsAny<CancellationToken>()), Times.Never);
    }

    private static AtendimentoController BuildController(Mock<IAtendimentoService> svc, params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new AtendimentoController(svc.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }
}
