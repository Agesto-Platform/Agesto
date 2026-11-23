using System.Net;
using System.Text;
using System.Text.Json;
using Anthropic;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MicroERP.Api.Services.Insights;

namespace MicroERP.Tests.Services;

// Laço de consultas do chat do Agente (KAN-77) contra respostas simuladas da API
// da Anthropic: confere o que o SDK envia de volta (eco da fala, resultado de cada
// consulta) sem rede e sem chave.
public sealed class ClaudeInsightsGeradorFerramentasTests
{
    private static readonly IReadOnlyList<MensagemIA> Pergunta = [new(true, "Quem está me devendo?")];

    [Fact]
    public async Task ResponderAsync_ExecutaAConsultaEDevolveOResultadoAoModelo()
    {
        var api = new ApiFalsa(
            Mensagem("tool_use", 100, 20,
                """{"type":"thinking","thinking":"","signature":"assinatura-1"}""",
                """{"type":"tool_use","id":"toolu_1","name":"consultar_a_receber","input":{},"caller":{"type":"direct"}}"""),
            Mensagem("end_turn", 150, 30, """{"type":"text","text":"Você tem R$ 450,00 a receber."}"""));
        var executor = new ExecutorFalso("""{"valorTotal":450}""");

        var resposta = await Gerador(api).ResponderAsync(Pergunta, executor, CancellationToken.None);

        Assert.Equal("Você tem R$ 450,00 a receber.", resposta.Texto);
        Assert.Equal(250, resposta.TokensEntrada);
        Assert.Equal(50, resposta.TokensSaida);
        Assert.Equal(1, resposta.ConsultasFeitas);
        Assert.Equal(["consultar_a_receber"], executor.Chamadas);

        Assert.Equal(2, api.Pedidos.Count);
        var primeiro = JsonDocument.Parse(api.Pedidos[0]).RootElement;
        Assert.Contains(primeiro.GetProperty("tools").EnumerateArray(), t => t.GetProperty("name").GetString() == "consultar_a_receber");
        Assert.Equal("auto", primeiro.GetProperty("tool_choice").GetProperty("type").GetString());

        var mensagens = JsonDocument.Parse(api.Pedidos[1]).RootElement.GetProperty("messages").EnumerateArray().ToList();
        Assert.Equal(3, mensagens.Count);
        var eco = mensagens[1];
        Assert.Equal("assistant", eco.GetProperty("role").GetString());
        Assert.Contains(eco.GetProperty("content").EnumerateArray(), b => b.GetProperty("type").GetString() == "thinking"
            && b.GetProperty("signature").GetString() == "assinatura-1");
        var resultado = Assert.Single(mensagens[2].GetProperty("content").EnumerateArray());
        Assert.Equal("tool_result", resultado.GetProperty("type").GetString());
        Assert.Equal("toolu_1", resultado.GetProperty("tool_use_id").GetString());
        Assert.Contains("450", resultado.GetProperty("content").ToString());
    }

    [Fact]
    public async Task ResponderAsync_ConsultaInvalida_VoltaAoModeloComoErro()
    {
        var api = new ApiFalsa(
            Mensagem("tool_use", 10, 5,
                """{"type":"tool_use","id":"toolu_9","name":"historico_do_cliente","input":{"cliente_id":999},"caller":{"type":"direct"}}"""),
            Mensagem("end_turn", 10, 5, """{"type":"text","text":"Não achei esse cliente."}"""));
        var executor = new ExecutorFalso(erro: "Cliente não encontrado.");

        var resposta = await Gerador(api).ResponderAsync(Pergunta, executor, CancellationToken.None);

        Assert.Equal("Não achei esse cliente.", resposta.Texto);
        var mensagens = JsonDocument.Parse(api.Pedidos[1]).RootElement.GetProperty("messages").EnumerateArray().ToList();
        var resultado = Assert.Single(mensagens[2].GetProperty("content").EnumerateArray());
        Assert.True(resultado.GetProperty("is_error").GetBoolean());
        Assert.Contains("Cliente não encontrado.", resultado.GetProperty("content").ToString());
    }

    [Fact]
    public async Task ResponderAsync_DepoisDoLimiteDeRodadas_PedeRespostaSemConsultas()
    {
        var consulta = Mensagem("tool_use", 10, 5,
            """{"type":"tool_use","id":"toolu_x","name":"listar_equipe","input":{},"caller":{"type":"direct"}}""");
        var api = new ApiFalsa(consulta, consulta, consulta, consulta,
            Mensagem("end_turn", 10, 5, """{"type":"text","text":"Resposta final."}"""));

        var resposta = await Gerador(api).ResponderAsync(Pergunta, new ExecutorFalso("[]"), CancellationToken.None);

        Assert.Equal("Resposta final.", resposta.Texto);
        Assert.Equal(4, resposta.ConsultasFeitas);
        Assert.Equal(5, api.Pedidos.Count);
        var ultimo = JsonDocument.Parse(api.Pedidos[^1]).RootElement;
        Assert.Equal("none", ultimo.GetProperty("tool_choice").GetProperty("type").GetString());
    }

    [Fact]
    public async Task ResponderAsync_SemFerramentas_NaoEnviaTools()
    {
        var api = new ApiFalsa(Mensagem("end_turn", 10, 5, """{"type":"text","text":"Oi!"}"""));

        var resposta = await Gerador(api).ResponderAsync(Pergunta, null, CancellationToken.None);

        Assert.Equal("Oi!", resposta.Texto);
        Assert.False(JsonDocument.Parse(api.Pedidos[0]).RootElement.TryGetProperty("tools", out _));
    }

    private static ClaudeInsightsGerador Gerador(ApiFalsa api) => new(
        Options.Create(new InsightsOptions { AnthropicApiKey = "chave-de-teste", Modelo = "claude-haiku-5-5" }),
        NullLogger<ClaudeInsightsGerador>.Instance,
        new AnthropicClient { ApiKey = "chave-de-teste", HttpClient = new HttpClient(api), MaxRetries = 0 });

    private static string Mensagem(string stopReason, int entrada, int saida, params string[] blocos) => $$$"""
        {"id":"msg_teste","type":"message","role":"assistant","model":"claude-haiku-5-5",
         "content":[{{{string.Join(",", blocos)}}}],
         "stop_reason":"{{{stopReason}}}","stop_sequence":null,"container":null,"context_management":null,
         "usage":{"input_tokens":{{{entrada}}},"output_tokens":{{{saida}}},"cache_creation_input_tokens":0,
                  "cache_read_input_tokens":0,"cache_creation":null,"server_tool_use":null,"service_tier":"standard"}}
        """;

    private sealed class ApiFalsa : HttpMessageHandler
    {
        private readonly Queue<string> _respostas;

        public ApiFalsa(params string[] respostas) => _respostas = new Queue<string>(respostas);

        public List<string> Pedidos { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Pedidos.Add(await request.Content!.ReadAsStringAsync(cancellationToken));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_respostas.Dequeue(), Encoding.UTF8, "application/json"),
            };
        }
    }

    private sealed class ExecutorFalso : IExecutorDeFerramentas
    {
        private readonly string? _resultado;
        private readonly string? _erro;

        public ExecutorFalso(string? resultado = null, string? erro = null)
        {
            _resultado = resultado;
            _erro = erro;
        }

        public List<string> Chamadas { get; } = [];

        public IReadOnlyList<FerramentaIA> Ferramentas { get; } =
        [
            new("consultar_a_receber", "A receber.", new Dictionary<string, JsonElement>(), []),
            new("historico_do_cliente", "Histórico.",
                new Dictionary<string, JsonElement> { ["cliente_id"] = JsonSerializer.SerializeToElement(new { type = "integer" }) },
                ["cliente_id"]),
            new("listar_equipe", "Equipe.", new Dictionary<string, JsonElement>(), []),
        ];

        public Task<string> ExecutarAsync(string nome, JsonElement entrada, CancellationToken cancellationToken)
        {
            Chamadas.Add(nome);
            if (_erro is not null) throw new FerramentaInvalidaException(_erro);
            return Task.FromResult(_resultado!);
        }
    }
}
