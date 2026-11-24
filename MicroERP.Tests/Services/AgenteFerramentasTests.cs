using System.Text.Json;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Moq;

namespace MicroERP.Tests.Services;

// Consultas da IA no chat do Agente (KAN-77): presas à empresa do login, sem
// CPF, telefone nem endereço no que volta ao modelo.
public sealed class AgenteFerramentasTests
{
    private const long Empresa = 7;

    private readonly Mock<IAtendimentoService> _atendimentos = new();
    private readonly Mock<IOrcamentoService> _orcamentos = new();
    private readonly Mock<IClienteService> _clientes = new();
    private readonly Mock<IProdutoService> _produtos = new();
    private readonly Mock<IMetricasService> _metricas = new();
    private readonly Mock<IUsuarioService> _usuarios = new();

    private IAgenteFerramentas Criar() => new AgenteFerramentasFactory(
        _atendimentos.Object, _orcamentos.Object, _clientes.Object, _produtos.Object, _metricas.Object, _usuarios.Object)
        .Criar(Empresa);

    private static JsonElement Entrada(object valor) => JsonSerializer.SerializeToElement(valor);

    [Fact]
    public void Ferramentas_CamposObrigatoriosExistemNoEsquema()
    {
        foreach (var f in Criar().Ferramentas)
        {
            Assert.Matches("^[a-z_]+$", f.Nome);
            Assert.False(string.IsNullOrWhiteSpace(f.Descricao));
            Assert.All(f.Obrigatorias, campo => Assert.True(f.Propriedades.ContainsKey(campo), $"{f.Nome}.{campo}"));
        }
    }

    [Fact]
    public async Task AReceber_MostraOsMaisAntigosPrimeiroSemTelefone()
    {
        var hoje = DateTime.UtcNow;
        _atendimentos.Setup(a => a.ContarPorStatusAsync(Empresa, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AtendimentoContagemResponse { AReceber = 2, ValorAReceber = 700m });
        _atendimentos.Setup(a => a.GetPaginaAsync(Empresa, It.IsAny<PaginacaoQuery>(),
                It.Is<AtendimentoFiltroQuery>(f => f.Recebimento == AtendimentoFiltroQuery.RecebimentoAReceber), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PaginaResponse<AtendimentoResponse>
            {
                Itens =
                [
                    new() { Id = 1, ClienteId = 10, ClienteNome = "Bruno", ClienteTelefone = "11911112222", DataRegistro = hoje.AddDays(-2), ValorTotal = 200m, Resumo = "Limpeza" },
                    new() { Id = 2, ClienteId = 11, ClienteNome = "Carla", ClienteTelefone = "11933334444", DataRegistro = hoje.AddDays(-20), ValorTotal = 500m, Resumo = "Instalação" },
                ],
            });

        var json = await Criar().ExecutarAsync("consultar_a_receber", Entrada(new { }), CancellationToken.None);

        var raiz = JsonDocument.Parse(json).RootElement;
        Assert.Equal(700m, raiz.GetProperty("valorTotal").GetDecimal());
        var itens = raiz.GetProperty("itens").EnumerateArray().ToList();
        Assert.Equal("Carla", itens[0].GetProperty("cliente").GetString());
        Assert.InRange(itens[0].GetProperty("diasEmAberto").GetInt32(), 19, 21);
        Assert.DoesNotContain("11933334444", json);
        Assert.DoesNotContain("11911112222", json);
    }

    [Fact]
    public async Task ListarAtendimentos_LePeriodoEmBrasiliaEFiltraPorStatus()
    {
        DateTime? de = null, ate = null;
        _atendimentos.Setup(a => a.GetAgendaAsync(Empresa, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), 4, true, It.IsAny<CancellationToken>()))
            .Callback<long, DateTime?, DateTime?, long?, bool, CancellationToken>((_, d, a, _, _, _) => { de = d; ate = a; })
            .ReturnsAsync(
            [
                new AgendaItemResponse { Id = 1, UsuarioId = 4, Status = StatusAtendimento.Concluido, ClienteNome = "Ana", ClienteTelefone = "11955556666", EnderecoCompleto = "Rua X, 1", DataRegistro = new DateTime(2026, 11, 3, 15, 0, 0, DateTimeKind.Utc), ValorTotal = 300m, Resumo = "Revisão" },
                new AgendaItemResponse { Id = 2, UsuarioId = 4, Status = StatusAtendimento.Pendente, ClienteNome = "Beto", DataRegistro = new DateTime(2026, 11, 4, 15, 0, 0, DateTimeKind.Utc), ValorTotal = 100m },
            ]);
        _usuarios.Setup(u => u.GetAllAsync(Empresa, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new UsuarioResponse { Id = 4, Nome = "João", Email = "joao@empresa" }]);

        var json = await Criar().ExecutarAsync("listar_atendimentos",
            Entrada(new { de = "2026-11-01", ate = "2026-11-30", status = "Concluido", responsavel_id = 4 }), CancellationToken.None);

        Assert.Equal(new DateTime(2026, 11, 1, 3, 0, 0, DateTimeKind.Utc), de);
        Assert.Equal(new DateTime(2026, 12, 1, 3, 0, 0, DateTimeKind.Utc).AddTicks(-1), ate);
        var item = Assert.Single(JsonDocument.Parse(json).RootElement.GetProperty("itens").EnumerateArray());
        Assert.Equal("Ana", item.GetProperty("cliente").GetString());
        Assert.Equal("João", item.GetProperty("responsavel").GetString());
        Assert.DoesNotContain("11955556666", json);
        Assert.DoesNotContain("Rua X", json);
        Assert.DoesNotContain("joao@empresa", json);
    }

    [Theory]
    [InlineData("01/11/2026", "2026-11-30")]
    [InlineData("2026-11-30", "2026-11-01")]
    public async Task ListarAtendimentos_PeriodoInvalido_VoltaComoErroDeConsulta(string de, string ate)
    {
        await Assert.ThrowsAsync<FerramentaInvalidaException>(
            () => Criar().ExecutarAsync("listar_atendimentos", Entrada(new { de, ate }), CancellationToken.None));
    }

    [Fact]
    public async Task ListarAtendimentos_AcimaDe62Dias_VoltaComoErroDeConsulta()
    {
        _atendimentos.Setup(a => a.GetAgendaAsync(Empresa, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, true, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ArgumentException("O período da agenda é de no máximo 62 dias."));

        var ex = await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("listar_atendimentos",
            Entrada(new { de = "2026-01-01", ate = "2026-12-31" }), CancellationToken.None));
        Assert.Contains("62 dias", ex.Message);
    }

    [Fact]
    public async Task ListarOrcamentos_ParadosHaDias_FiltraEOrdena()
    {
        var agora = DateTime.UtcNow;
        _orcamentos.Setup(o => o.GetPaginaAsync(Empresa, It.IsAny<PaginacaoQuery>(),
                It.Is<OrcamentoFiltroQuery>(f => f.Status == StatusOrcamento.Enviado), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PaginaResponse<OrcamentoResponse>
            {
                Itens =
                [
                    new() { Id = 1, ClienteNome = "Novo", Status = StatusOrcamento.Enviado, DataRegistro = agora, UpdatedAt = agora, ValorTotal = 100m },
                    new() { Id = 2, ClienteNome = "Antigo", Status = StatusOrcamento.Enviado, DataRegistro = agora.AddDays(-15), UpdatedAt = agora.AddDays(-12), ValorTotal = 900m },
                ],
            });

        var json = await Criar().ExecutarAsync("listar_orcamentos", Entrada(new { status = "Enviado", parados_ha_dias = 7 }), CancellationToken.None);

        var raiz = JsonDocument.Parse(json).RootElement;
        Assert.Equal(1, raiz.GetProperty("total").GetInt32());
        Assert.Equal("Antigo", Assert.Single(raiz.GetProperty("itens").EnumerateArray()).GetProperty("cliente").GetString());
    }

    [Fact]
    public async Task DesempenhoDaEquipe_SomaSoOsConcluidosPorPessoa()
    {
        _atendimentos.Setup(a => a.GetAgendaAsync(Empresa, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new AgendaItemResponse { UsuarioId = 4, Status = StatusAtendimento.Concluido, ValorTotal = 300m },
                new AgendaItemResponse { UsuarioId = 4, Status = StatusAtendimento.Concluido, ValorTotal = 200m },
                new AgendaItemResponse { UsuarioId = 4, Status = StatusAtendimento.Cancelado, ValorTotal = 999m },
                new AgendaItemResponse { UsuarioId = 5, Status = StatusAtendimento.Pendente, ValorTotal = 80m },
            ]);
        _usuarios.Setup(u => u.GetAllAsync(Empresa, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new UsuarioResponse { Id = 4, Nome = "João", Ativo = true }, new UsuarioResponse { Id = 5, Nome = "Lia", Ativo = true }]);

        var json = await Criar().ExecutarAsync("desempenho_da_equipe", Entrada(new { de = "2026-11-01", ate = "2026-11-30" }), CancellationToken.None);

        var pessoas = JsonDocument.Parse(json).RootElement.EnumerateArray().ToList();
        Assert.Equal("João", pessoas[0].GetProperty("nome").GetString());
        Assert.Equal(500m, pessoas[0].GetProperty("faturamento").GetDecimal());
        Assert.Equal(1, pessoas[0].GetProperty("cancelados").GetInt32());
        Assert.Equal(1, pessoas[1].GetProperty("pendentes").GetInt32());
    }

    [Fact]
    public async Task PrepararWhatsApp_GuardaORascunhoSemDevolverOTelefoneAoModelo()
    {
        _clientes.Setup(c => c.GetByIdAsync(Empresa, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClienteResponse { Id = 10, Nome = "Bruno", Telefone = "11911112222", Cpf = "12345678909" });
        var ferramentas = Criar();

        var resultado = await ferramentas.ExecutarAsync("preparar_whatsapp",
            Entrada(new { cliente_id = 10, mensagem = "Oi, Bruno! Lembrando do pagamento da limpeza." }), CancellationToken.None);

        Assert.DoesNotContain("11911112222", resultado);
        var acao = Assert.Single(ferramentas.Acoes);
        Assert.Equal("whatsapp", acao.Tipo);
        Assert.Equal("11911112222", acao.Telefone);
        Assert.Equal("Oi, Bruno! Lembrando do pagamento da limpeza.", acao.Mensagem);
    }

    [Fact]
    public async Task PrepararWhatsApp_ClienteSemTelefone_VoltaComoErroDeConsulta()
    {
        _clientes.Setup(c => c.GetByIdAsync(Empresa, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ClienteResponse { Id = 10, Nome = "Bruno", Telefone = null });
        var ferramentas = Criar();

        await Assert.ThrowsAsync<FerramentaInvalidaException>(() => ferramentas.ExecutarAsync("preparar_whatsapp",
            Entrada(new { cliente_id = 10, mensagem = "Oi" }), CancellationToken.None));
        Assert.Empty(ferramentas.Acoes);
    }

    // ---------- fase 2 (DEC-62): propostas de mudança em atendimentos ----------

    private static readonly TimeZoneInfo Brasilia = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    private static DateOnly DiaDaqui(int dias) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Brasilia)).AddDays(dias);

    private static DateTime Utc(DateOnly dia, int hora, int minuto) =>
        TimeZoneInfo.ConvertTimeToUtc(dia.ToDateTime(new TimeOnly(hora, minuto)), Brasilia);

    private void Pendente(long id, DateTime? dataAgendada, long responsavel = 4, StatusAtendimento status = StatusAtendimento.Pendente)
    {
        _atendimentos.Setup(a => a.GetByIdAsync(Empresa, id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AtendimentoResponse
            {
                Id = id, ClienteId = 10, ClienteNome = "Bruno", ClienteTelefone = "11911112222", Status = status,
                DataAgendada = dataAgendada, UsuarioId = responsavel, Resumo = "Limpeza",
            });
        _usuarios.Setup(u => u.GetAllAsync(Empresa, It.IsAny<CancellationToken>()))
            .ReturnsAsync(
            [
                new UsuarioResponse { Id = 4, Nome = "João", Ativo = true },
                new UsuarioResponse { Id = 5, Nome = "Lia", Ativo = true },
                new UsuarioResponse { Id = 6, Nome = "Rui", Ativo = false },
            ]);
    }

    [Fact]
    public async Task ProporMudanca_ReagendarSoODia_MantemOHorarioENaoGrava()
    {
        var atual = Utc(DiaDaqui(5), 14, 30);
        Pendente(1, atual);
        var ferramentas = Criar();

        var resultado = await ferramentas.ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, nova_data = DiaDaqui(8).ToString("yyyy-MM-dd") }), CancellationToken.None);

        Assert.Contains("Nada mudou ainda", resultado);
        Assert.DoesNotContain("11911112222", resultado);
        var acao = Assert.Single(ferramentas.Acoes);
        Assert.Equal("atendimento", acao.Tipo);
        Assert.Equal(1, acao.AtendimentoId);
        Assert.Equal(atual, acao.DataAtual);
        Assert.Equal(Utc(DiaDaqui(8), 14, 30), acao.NovaData);
        Assert.Null(acao.NovoStatus);
        Assert.Null(acao.NovoResponsavelId);
        Assert.Equal("João", acao.ResponsavelAtualNome);
        Assert.Empty(acao.Telefone);
        _atendimentos.Verify(a => a.UpdateAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<AtendimentoUpdateRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProporMudanca_SoAHora_MantemODia()
    {
        Pendente(1, Utc(DiaDaqui(5), 14, 30));
        var ferramentas = Criar();

        await ferramentas.ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, nova_hora = "09:15" }), CancellationToken.None);

        Assert.Equal(Utc(DiaDaqui(5), 9, 15), Assert.Single(ferramentas.Acoes).NovaData);
    }

    [Fact]
    public async Task ProporMudanca_ConcluirETrocarResponsavel()
    {
        Pendente(1, Utc(DiaDaqui(-1), 10, 0));
        var ferramentas = Criar();

        await ferramentas.ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, novo_status = "Concluido", novo_responsavel_id = 5 }), CancellationToken.None);

        var acao = Assert.Single(ferramentas.Acoes);
        Assert.Equal("Concluido", acao.NovoStatus);
        Assert.Equal(5, acao.NovoResponsavelId);
        Assert.Equal("Lia", acao.NovoResponsavelNome);
        Assert.Null(acao.NovaData);
    }

    [Theory]
    [InlineData("{\"atendimento_id\":1,\"novo_status\":\"Cancelado\",\"novo_responsavel_id\":5}")]
    [InlineData("{\"atendimento_id\":1,\"novo_status\":\"Concluido\",\"nova_hora\":\"10:00\"}")]
    [InlineData("{\"atendimento_id\":1,\"novo_status\":\"Pendente\"}")]
    [InlineData("{\"atendimento_id\":1,\"nova_hora\":\"25:00\"}")]
    [InlineData("{\"atendimento_id\":1,\"novo_responsavel_id\":6}")]
    [InlineData("{\"atendimento_id\":1,\"novo_responsavel_id\":99}")]
    [InlineData("{\"atendimento_id\":1,\"novo_responsavel_id\":4}")]
    [InlineData("{\"atendimento_id\":1}")]
    public async Task ProporMudanca_PedidoInvalido_VoltaComoErroSemProposta(string json)
    {
        Pendente(1, Utc(DiaDaqui(5), 14, 30));
        var ferramentas = Criar();

        await Assert.ThrowsAsync<FerramentaInvalidaException>(() => ferramentas.ExecutarAsync("propor_mudanca_atendimento",
            JsonDocument.Parse(json).RootElement, CancellationToken.None));
        Assert.Empty(ferramentas.Acoes);
    }

    [Fact]
    public async Task ProporMudanca_DataQueJaPassou_VoltaComoErro()
    {
        Pendente(1, Utc(DiaDaqui(5), 14, 30));

        var ex = await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, nova_data = DiaDaqui(-2).ToString("yyyy-MM-dd") }), CancellationToken.None));
        Assert.Contains("já passaram", ex.Message);
    }

    [Fact]
    public async Task ProporMudanca_AtendimentoQueNaoEstaPendente_VoltaComoErro()
    {
        Pendente(1, Utc(DiaDaqui(-3), 9, 0), status: StatusAtendimento.Concluido);

        var ex = await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, novo_status = "Cancelado" }), CancellationToken.None));
        Assert.Contains("Só atendimentos pendentes", ex.Message);
    }

    [Fact]
    public async Task ProporMudanca_SemDataMarcada_PedeDiaEHora()
    {
        Pendente(1, null);

        await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 1, nova_hora = "10:00" }), CancellationToken.None));
    }

    [Fact]
    public async Task ProporMudanca_AtendimentoDeOutraEmpresa_VoltaComoNaoEncontrado()
    {
        _atendimentos.Setup(a => a.GetByIdAsync(Empresa, 99, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new NotFoundException("Atendimento não encontrado."));

        var ex = await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("propor_mudanca_atendimento",
            Entrada(new { atendimento_id = 99, novo_status = "Cancelado" }), CancellationToken.None));
        Assert.Equal("Atendimento não encontrado.", ex.Message);
    }

    [Fact]
    public async Task ClienteDeOutraEmpresa_VoltaComoNaoEncontrado()
    {
        _clientes.Setup(c => c.GetByIdAsync(Empresa, 99, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new NotFoundException("Cliente não encontrado."));

        var ex = await Assert.ThrowsAsync<FerramentaInvalidaException>(() => Criar().ExecutarAsync("historico_do_cliente",
            Entrada(new { cliente_id = 99 }), CancellationToken.None));
        Assert.Equal("Cliente não encontrado.", ex.Message);
    }

    [Fact]
    public async Task ConsultaDesconhecida_VoltaComoErroDeConsulta()
    {
        await Assert.ThrowsAsync<FerramentaInvalidaException>(
            () => Criar().ExecutarAsync("apagar_tudo", Entrada(new { }), CancellationToken.None));
    }
}
