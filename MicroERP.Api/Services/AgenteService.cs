using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Chat do painel Agente (DEC-21): responde perguntas do Dono com as métricas
// já calculadas do período (DEC-20) e a agenda dos próximos 7 dias. Só leitura.
// Da agenda saem só horário, status, serviço e valor: nome, telefone e
// endereço do cliente não são enviados ao modelo.
public sealed class AgenteService : IAgenteService
{
    private const int DiasDeAgenda = 7;
    private const int MaxItensDeAgenda = 50;

    // Acentos sem escape (ç): o JSON vai para o modelo, não para HTML.
    private static readonly JsonSerializerOptions JsonEnvio = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
    private static readonly string[] DiasDaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    private static readonly TimeZoneInfo Brasilia = ResolverFusoDeBrasilia();

    private readonly IMetricasService _metricasService;
    private readonly IAtendimentoService _atendimentoService;
    private readonly IInsightsGerador _gerador;
    private readonly IUsoIaService _usoIa;
    private readonly ILogger<AgenteService> _logger;

    public AgenteService(
        IMetricasService metricasService,
        IAtendimentoService atendimentoService,
        IInsightsGerador gerador,
        IUsoIaService usoIa,
        ILogger<AgenteService> logger)
    {
        _metricasService = metricasService;
        _atendimentoService = atendimentoService;
        _gerador = gerador;
        _usoIa = usoIa;
        _logger = logger;
    }

    public async Task<AgenteRespostaResponse> PerguntarAsync(long empresaId, AgentePerguntaRequest request, CancellationToken cancellationToken)
    {
        if (!_gerador.Habilitado)
            throw new InsightsIndisponivelException("O Agente ainda não está configurado neste servidor.");

        var pergunta = request.Pergunta.Trim();
        if (pergunta.Length == 0)
            throw new ArgumentException("Pergunta obrigatória.", nameof(request));

        var agoraUtc = DateTime.UtcNow;
        var agoraLocal = TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, Brasilia);

        var dashboard = await _metricasService.GetDashboardAsync(empresaId, request.De, request.Ate, cancellationToken);

        // Agenda de hoje (00:00 em Brasília) até o fim do 7º dia.
        var inicioHojeUtc = TimeZoneInfo.ConvertTimeToUtc(agoraLocal.Date, Brasilia);
        var agenda = await _atendimentoService.GetAgendaAsync(
            empresaId, inicioHojeUtc, inicioHojeUtc.AddDays(DiasDeAgenda + 1).AddTicks(-1), null, cancellationToken);

        var dados = new
        {
            agora = $"{Formatar(agoraLocal)} (horário de Brasília)",
            periodo = new
            {
                de = Formatar(TimeZoneInfo.ConvertTimeFromUtc(Utc(dashboard.De), Brasilia)),
                ate = Formatar(TimeZoneInfo.ConvertTimeFromUtc(Utc(dashboard.Ate), Brasilia)),
            },
            metricas = new { dashboard.Rentabilidade, dashboard.Vendas, dashboard.Servicos, dashboard.Estoque },
            agenda = agenda
                .Where(a => a.DataAgendada is not null)
                .OrderBy(a => a.DataAgendada)
                .Take(MaxItensDeAgenda)
                .Select(a => new
                {
                    quando = Formatar(TimeZoneInfo.ConvertTimeFromUtc(Utc(a.DataAgendada!.Value), Brasilia)),
                    status = a.Status.ToString(),
                    servico = a.Resumo,
                    itens = a.Itens.Select(i => $"{i.Quantidade}x {i.Descricao}").ToList(),
                    valor = a.ValorTotal,
                }),
        };

        var ultimaMensagem = $"<dados>\n{JsonSerializer.Serialize(dados, JsonEnvio)}\n</dados>\n\n{pergunta}";
        var conversa = MontarConversa(request.Historico, ultimaMensagem);

        // Limite diário por empresa (DEC-21): reserva a pergunta antes de chamar
        // o modelo e devolve se ele falhar, para a empresa não pagar pela falha.
        var restantes = await _usoIa.ReservarPerguntaAsync(empresaId, cancellationToken);
        RespostaIA resposta;
        try
        {
            resposta = await _gerador.ResponderAsync(conversa, cancellationToken);
        }
        catch
        {
            await _usoIa.DevolverPerguntaAsync(empresaId, CancellationToken.None);
            throw;
        }

        await _usoIa.RegistrarTokensDaPerguntaAsync(empresaId, resposta.TokensEntrada, resposta.TokensSaida, CancellationToken.None);
        _logger.LogInformation(
            "Agente IA respondeu: empresa {EmpresaId}, modelo {Modelo}, tokens de entrada {TokensEntrada}, tokens de saída {TokensSaida}",
            empresaId, resposta.Modelo, resposta.TokensEntrada, resposta.TokensSaida);

        return new AgenteRespostaResponse
        {
            Resposta = resposta.Texto,
            Modelo = resposta.Modelo,
            PerguntasRestantes = restantes,
            LimiteDiario = _usoIa.PerguntasPorDia,
        };
    }

    // A API da Anthropic exige que a conversa comece com o usuário e alterne
    // os papéis. O histórico vem do navegador, então é normalizado aqui:
    // descarta respostas do agente antes da primeira pergunta e junta mensagens
    // seguidas do mesmo papel. A última mensagem é sempre a pergunta atual.
    public static IReadOnlyList<MensagemIA> MontarConversa(IEnumerable<AgenteMensagemRequest> historico, string ultimaMensagem)
    {
        var conversa = new List<MensagemIA>();
        foreach (var item in historico)
        {
            var texto = item.Texto.Trim();
            if (texto.Length == 0) continue;

            var doUsuario = item.Papel == "usuario";
            if (conversa.Count == 0 && !doUsuario) continue;

            if (conversa.Count > 0 && conversa[^1].DoUsuario == doUsuario)
                conversa[^1] = conversa[^1] with { Texto = $"{conversa[^1].Texto}\n\n{texto}" };
            else
                conversa.Add(new MensagemIA(doUsuario, texto));
        }

        if (conversa.Count > 0 && conversa[^1].DoUsuario)
            conversa[^1] = conversa[^1] with { Texto = $"{conversa[^1].Texto}\n\n{ultimaMensagem}" };
        else
            conversa.Add(new MensagemIA(true, ultimaMensagem));

        return conversa;
    }

    private static string Formatar(DateTime local) =>
        $"{DiasDaSemana[(int)local.DayOfWeek]} {local.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture)}";

    // Datas do banco são UTC; o EF pode devolvê-las com Kind Unspecified.
    private static DateTime Utc(DateTime data) =>
        data.Kind == DateTimeKind.Utc ? data : DateTime.SpecifyKind(data, DateTimeKind.Utc);

    private static TimeZoneInfo ResolverFusoDeBrasilia()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var fuso)) return fuso;
        }
        return TimeZoneInfo.CreateCustomTimeZone("Brasilia", TimeSpan.FromHours(-3), "Brasília", "Brasília");
    }
}
