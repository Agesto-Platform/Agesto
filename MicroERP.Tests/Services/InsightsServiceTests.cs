using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class InsightsServiceTests
{
    private static readonly DateTime De = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Ate = new(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc);

    [Fact]
    public async Task GerarAsync_SemChave_LancaIndisponivelSemLerMetricas()
    {
        var metricas = new Mock<IMetricasService>(MockBehavior.Strict);
        var gerador = new Mock<IInsightsGerador>();
        gerador.SetupGet(g => g.Habilitado).Returns(false);

        var usoIa = new Mock<IUsoIaService>();
        var service = new InsightsService(metricas.Object, gerador.Object, usoIa.Object, NullLogger<InsightsService>.Instance);

        await Assert.ThrowsAsync<InsightsIndisponivelException>(
            () => service.GerarAsync(1, De, Ate, CancellationToken.None));
        gerador.Verify(g => g.GerarAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GerarAsync_UsaSoAsMetricasDaEmpresaDoTokenEMapeiaOsQuatroBlocos()
    {
        var dashboard = new DashboardResponse
        {
            De = De,
            Ate = Ate,
            Rentabilidade = new MetricasRentabilidadeResponse { Faturamento = 1500m, Atendimentos = 5 },
        };
        var metricas = new Mock<IMetricasService>();
        metricas.Setup(m => m.GetDashboardAsync(7, De, Ate, It.IsAny<CancellationToken>())).ReturnsAsync(dashboard);

        string? enviado = null;
        var gerador = new Mock<IInsightsGerador>();
        gerador.SetupGet(g => g.Habilitado).Returns(true);
        gerador.Setup(g => g.GerarAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((json, _) => enviado = json)
            .ReturnsAsync(new InsightsGerados
            {
                Resumo = "Mês bom.",
                Destaques = ["Instalação rendeu mais."],
                Alertas = ["Cano acabando."],
                Recomendacoes = ["Repor cano."],
                Modelo = "claude-opus-5-5",
            });

        var usoIa = new Mock<IUsoIaService>();
        var service = new InsightsService(metricas.Object, gerador.Object, usoIa.Object, NullLogger<InsightsService>.Instance);
        var insights = await service.GerarAsync(7, De, Ate, CancellationToken.None);

        metricas.Verify(m => m.GetDashboardAsync(7, De, Ate, It.IsAny<CancellationToken>()), Times.Once);
        usoIa.Verify(u => u.RegistrarRelatorioAsync(7, It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.NotNull(enviado);
        using var json = JsonDocument.Parse(enviado!);
        Assert.Equal(1500m, json.RootElement.GetProperty("rentabilidade").GetProperty("faturamento").GetDecimal());

        Assert.Equal(De, insights.De);
        Assert.Equal(Ate, insights.Ate);
        Assert.Equal("Mês bom.", insights.Resumo);
        Assert.Equal(["Instalação rendeu mais."], insights.Destaques);
        Assert.Equal(["Cano acabando."], insights.Alertas);
        Assert.Equal(["Repor cano."], insights.Recomendacoes);
        Assert.Equal("claude-opus-5-5", insights.Modelo);
    }

    [Fact]
    public void LerResposta_LeOsQuatroBlocosDaSaidaEstruturada()
    {
        const string json = """
            {"resumo":"Período fraco.","destaques":[],"alertas":["Margem baixa."],"recomendacoes":["Rever preços."]}
            """;

        var gerados = ClaudeInsightsGerador.LerResposta(json);

        Assert.Equal("Período fraco.", gerados.Resumo);
        Assert.Empty(gerados.Destaques);
        Assert.Equal(["Margem baixa."], gerados.Alertas);
        Assert.Equal(["Rever preços."], gerados.Recomendacoes);
    }

    [Fact]
    public void LerResposta_JsonInvalido_LancaIndisponivel()
    {
        Assert.Throws<InsightsIndisponivelException>(() => ClaudeInsightsGerador.LerResposta("não é json"));
    }

    [Fact]
    public void Gerador_SemChave_FicaDesabilitado()
    {
        var gerador = new ClaudeInsightsGerador(
            Options.Create(new InsightsOptions { AnthropicApiKey = " " }), NullLogger<ClaudeInsightsGerador>.Instance);
        Assert.False(gerador.Habilitado);
    }
}
