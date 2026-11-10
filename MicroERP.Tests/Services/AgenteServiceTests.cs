using Microsoft.Extensions.Logging.Abstractions;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class AgenteServiceTests
{
    private static readonly DateTime De = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Ate = new(2026, 6, 30, 23, 59, 59, DateTimeKind.Utc);

    [Fact]
    public async Task PerguntarAsync_SemChave_LancaIndisponivelSemLerDados()
    {
        var metricas = new Mock<IMetricasService>(MockBehavior.Strict);
        var atendimentos = new Mock<IAtendimentoService>(MockBehavior.Strict);
        var gerador = new Mock<IInsightsGerador>();
        gerador.SetupGet(g => g.Habilitado).Returns(false);

        var service = new AgenteService(metricas.Object, atendimentos.Object, gerador.Object, NullLogger<AgenteService>.Instance);

        await Assert.ThrowsAsync<InsightsIndisponivelException>(
            () => service.PerguntarAsync(1, new AgentePerguntaRequest { Pergunta = "Quanto sobrou?" }, CancellationToken.None));
    }

    [Fact]
    public async Task PerguntarAsync_EnviaMetricasEAgendaSemDadosDoClienteEDevolveAResposta()
    {
        var metricas = new Mock<IMetricasService>();
        metricas.Setup(m => m.GetDashboardAsync(7, De, Ate, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DashboardResponse
            {
                De = De,
                Ate = Ate,
                Rentabilidade = new MetricasRentabilidadeResponse { Faturamento = 1500m, Margem = 1100m },
            });

        var atendimentos = new Mock<IAtendimentoService>();
        atendimentos.Setup(a => a.GetAgendaAsync(7, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new AgendaItemResponse
                {
                    DataAgendada = DateTime.UtcNow.AddDays(1),
                    Status = StatusAtendimento.Pendente,
                    Resumo = "Instalação de split",
                    ValorTotal = 450m,
                    ClienteNome = "Maria Sigilosa",
                    ClienteTelefone = "11988887777",
                    EnderecoResumo = "Rua Secreta, 42",
                    EnderecoCompleto = "Rua Secreta, 42 - Centro",
                },
            ]);

        IReadOnlyList<MensagemIA>? conversa = null;
        var gerador = new Mock<IInsightsGerador>();
        gerador.SetupGet(g => g.Habilitado).Returns(true);
        gerador.Setup(g => g.ResponderAsync(It.IsAny<IReadOnlyList<MensagemIA>>(), It.IsAny<CancellationToken>()))
            .Callback<IReadOnlyList<MensagemIA>, CancellationToken>((c, _) => conversa = c)
            .ReturnsAsync(new RespostaIA("Sobraram R$ 1.100,00.", "claude-haiku-5-5", 900, 40));

        var service = new AgenteService(metricas.Object, atendimentos.Object, gerador.Object, NullLogger<AgenteService>.Instance);
        var resposta = await service.PerguntarAsync(7,
            new AgentePerguntaRequest { Pergunta = "Quanto sobrou este mês?", De = De, Ate = Ate },
            CancellationToken.None);

        Assert.Equal("Sobraram R$ 1.100,00.", resposta.Resposta);
        Assert.Equal("claude-haiku-5-5", resposta.Modelo);

        var enviado = Assert.Single(conversa!);
        Assert.True(enviado.DoUsuario);
        Assert.Contains("Quanto sobrou este mês?", enviado.Texto);
        Assert.Contains("\"margem\":1100", enviado.Texto);
        Assert.Contains("Instalação de split", enviado.Texto);
        Assert.DoesNotContain("Maria", enviado.Texto);
        Assert.DoesNotContain("11988887777", enviado.Texto);
        Assert.DoesNotContain("Rua Secreta", enviado.Texto);
    }

    [Fact]
    public void MontarConversa_ComecaComUsuarioAlternaPapeisETerminaComAPergunta()
    {
        var historico = new List<AgenteMensagemRequest>
        {
            new() { Papel = "agente", Texto = "Olá! Como posso ajudar?" },
            new() { Papel = "usuario", Texto = "Quanto faturei?" },
            new() { Papel = "agente", Texto = "R$ 1.500,00." },
            new() { Papel = "agente", Texto = "Quer ver por serviço?" },
            new() { Papel = "usuario", Texto = "   " },
        };

        var conversa = AgenteService.MontarConversa(historico, "E a margem?");

        Assert.Collection(conversa,
            m => { Assert.True(m.DoUsuario); Assert.Equal("Quanto faturei?", m.Texto); },
            m => { Assert.False(m.DoUsuario); Assert.Equal("R$ 1.500,00.\n\nQuer ver por serviço?", m.Texto); },
            m => { Assert.True(m.DoUsuario); Assert.Equal("E a margem?", m.Texto); });
    }

    [Fact]
    public void MontarConversa_HistoricoTerminandoComUsuario_JuntaComAPergunta()
    {
        var historico = new List<AgenteMensagemRequest> { new() { Papel = "usuario", Texto = "Oi" } };

        var conversa = AgenteService.MontarConversa(historico, "Quanto sobrou?");

        var unica = Assert.Single(conversa);
        Assert.Equal("Oi\n\nQuanto sobrou?", unica.Texto);
    }
}
