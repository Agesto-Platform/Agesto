using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class AgenteFerramentasFactory : IAgenteFerramentasFactory
{
    private readonly IAtendimentoService _atendimentos;
    private readonly IOrcamentoService _orcamentos;
    private readonly IClienteService _clientes;
    private readonly IProdutoService _produtos;
    private readonly IMetricasService _metricas;
    private readonly IUsuarioService _usuarios;

    public AgenteFerramentasFactory(
        IAtendimentoService atendimentos,
        IOrcamentoService orcamentos,
        IClienteService clientes,
        IProdutoService produtos,
        IMetricasService metricas,
        IUsuarioService usuarios)
    {
        _atendimentos = atendimentos;
        _orcamentos = orcamentos;
        _clientes = clientes;
        _produtos = produtos;
        _metricas = metricas;
        _usuarios = usuarios;
    }

    public IAgenteFerramentas Criar(long empresaId) =>
        new AgenteFerramentas(empresaId, _atendimentos, _orcamentos, _clientes, _produtos, _metricas, _usuarios);
}

// Consultas que a IA pode pedir no chat do Agente (KAN-77, fase 1: só leitura).
// Reaproveitam os serviços do painel, com as mesmas regras e o filtro por empresa.
// Ao modelo vão nomes de clientes e da equipe, valores, datas e status; nunca CPF,
// telefone, email nem endereço (decisão do Davi, 23/11/2026). As contas (totais,
// dias em aberto) são feitas aqui, não pelo modelo (DEC-20).
public sealed class AgenteFerramentas : IAgenteFerramentas
{
    private const int MaxItens = 30;
    private const int MaxMensagemWhatsApp = 1000;
    private const int MaxAcoes = 3;

    private static readonly JsonSerializerOptions JsonEnvio = new(JsonSerializerDefaults.Web)
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly IReadOnlyList<FerramentaIA> Definicoes =
    [
        new("consultar_a_receber",
            "Atendimentos concluídos que o cliente ainda não pagou: total geral e a lista, dos mais antigos para os mais novos, com cliente, data, dias em aberto e valor.",
            Props(), []),
        new("listar_atendimentos",
            "Atendimentos de um período de até 62 dias (agendados ou registrados nele), com cliente, responsável, status, serviço e valor, e os totais por status. Filtros opcionais de status e de responsável.",
            Props(
                ("de", Data("Primeiro dia do período")),
                ("ate", Data("Último dia do período")),
                ("status", Opcoes("Pendente", "Concluido", "Cancelado")),
                ("responsavel_id", Inteiro("Id da pessoa que atende (veja listar_equipe)"))),
            ["de", "ate"]),
        new("listar_orcamentos",
            "Orçamentos com cliente, status, valor e há quantos dias estão sem mudança. Para orçamentos enviados sem resposta, use status Enviado e parados_ha_dias.",
            Props(
                ("status", Opcoes("Rascunho", "Enviado", "Aprovado", "Recusado")),
                ("parados_ha_dias", Inteiro("Só os parados há pelo menos esse número de dias"))),
            []),
        new("metricas_do_periodo",
            "Métricas de qualquer período, já calculadas: faturamento, margem, ticket médio, produtos e serviços que mais faturaram e estoque. Use para outro período ou para comparar.",
            Props(("de", Data("Primeiro dia do período")), ("ate", Data("Último dia do período"))),
            ["de", "ate"]),
        new("listar_equipe",
            "Pessoas da empresa (dono e agentes de campo), com id, nome, perfil e se estão ativas.",
            Props(), []),
        new("desempenho_da_equipe",
            "Por pessoa da equipe, num período de até 62 dias: atendimentos concluídos, pendentes e cancelados e quanto faturou com os concluídos.",
            Props(("de", Data("Primeiro dia do período")), ("ate", Data("Último dia do período"))),
            ["de", "ate"]),
        new("buscar_clientes",
            "Procura clientes pelo nome. Devolve id, nome, total de atendimentos e o dia do último.",
            Props(("busca", Texto("Parte do nome do cliente"))),
            ["busca"]),
        new("historico_do_cliente",
            "Últimos atendimentos de um cliente, com data, status, serviço, valor e se já foi pago.",
            Props(("cliente_id", Inteiro("Id do cliente (veja buscar_clientes)"))),
            ["cliente_id"]),
        new("buscar_produtos",
            "Procura produtos pelo nome, com preço e quantidade em estoque.",
            Props(("busca", Texto("Parte do nome do produto"))),
            ["busca"]),
        new("preparar_whatsapp",
            "Prepara uma mensagem de WhatsApp para um cliente (cobrança, lembrete, confirmação). Não envia nada: o painel mostra um botão para o dono revisar e enviar pelo WhatsApp dele.",
            Props(
                ("cliente_id", Inteiro("Id do cliente (veja buscar_clientes)")),
                ("mensagem", Texto("Texto da mensagem, cordial e curto, em português"))),
            ["cliente_id", "mensagem"]),
    ];

    private readonly long _empresaId;
    private readonly IAtendimentoService _atendimentos;
    private readonly IOrcamentoService _orcamentos;
    private readonly IClienteService _clientes;
    private readonly IProdutoService _produtos;
    private readonly IMetricasService _metricas;
    private readonly IUsuarioService _usuarios;
    private readonly List<AcaoAgenteResponse> _acoes = [];

    public AgenteFerramentas(
        long empresaId,
        IAtendimentoService atendimentos,
        IOrcamentoService orcamentos,
        IClienteService clientes,
        IProdutoService produtos,
        IMetricasService metricas,
        IUsuarioService usuarios)
    {
        _empresaId = empresaId;
        _atendimentos = atendimentos;
        _orcamentos = orcamentos;
        _clientes = clientes;
        _produtos = produtos;
        _metricas = metricas;
        _usuarios = usuarios;
    }

    public IReadOnlyList<FerramentaIA> Ferramentas => Definicoes;

    public IReadOnlyList<AcaoAgenteResponse> Acoes => _acoes;

    public async Task<string> ExecutarAsync(string nome, JsonElement entrada, CancellationToken cancellationToken)
    {
        try
        {
            object resultado = nome switch
            {
                "consultar_a_receber" => await AReceberAsync(cancellationToken),
                "listar_atendimentos" => await AtendimentosAsync(entrada, cancellationToken),
                "listar_orcamentos" => await OrcamentosAsync(entrada, cancellationToken),
                "metricas_do_periodo" => await MetricasAsync(entrada, cancellationToken),
                "listar_equipe" => await EquipeAsync(cancellationToken),
                "desempenho_da_equipe" => await DesempenhoAsync(entrada, cancellationToken),
                "buscar_clientes" => await ClientesAsync(entrada, cancellationToken),
                "historico_do_cliente" => await HistoricoAsync(entrada, cancellationToken),
                "buscar_produtos" => await ProdutosAsync(entrada, cancellationToken),
                "preparar_whatsapp" => await WhatsAppAsync(entrada, cancellationToken),
                _ => throw new FerramentaInvalidaException($"A consulta \"{nome}\" não existe."),
            };
            return resultado as string ?? JsonSerializer.Serialize(resultado, JsonEnvio);
        }
        catch (NotFoundException ex)
        {
            throw new FerramentaInvalidaException(ex.Message);
        }
        catch (ArgumentException ex)
        {
            // Regras dos serviços, como o teto de 62 dias da agenda.
            throw new FerramentaInvalidaException(ex.Message);
        }
    }

    private async Task<object> AReceberAsync(CancellationToken ct)
    {
        var contagem = await _atendimentos.ContarPorStatusAsync(_empresaId, ct);
        var pagina = await _atendimentos.GetPaginaAsync(
            _empresaId,
            new PaginacaoQuery { Tamanho = PaginacaoQuery.TamanhoMaximo },
            new AtendimentoFiltroQuery
            {
                Recebimento = AtendimentoFiltroQuery.RecebimentoAReceber,
                Ordem = AtendimentoFiltroQuery.OrdemRegistro,
            },
            ct);

        var hoje = Hoje();
        var itens = pagina.Itens
            .Select(a =>
            {
                var dia = FusoBrasilia.DiaLocal(a.DataAgendada ?? a.DataRegistro);
                return new
                {
                    atendimentoId = a.Id,
                    clienteId = a.ClienteId,
                    cliente = a.ClienteNome,
                    servico = a.Resumo,
                    data = Formatar(dia),
                    diasEmAberto = hoje.DayNumber - dia.DayNumber,
                    valor = a.ValorTotal,
                };
            })
            .OrderByDescending(x => x.diasEmAberto)
            .Take(MaxItens)
            .ToList();

        return new
        {
            totalAtendimentos = contagem.AReceber,
            valorTotal = contagem.ValorAReceber,
            mostrando = itens.Count,
            itens,
        };
    }

    private async Task<object> AtendimentosAsync(JsonElement entrada, CancellationToken ct)
    {
        var (inicio, fim) = LerPeriodo(entrada);
        var status = LerEnum<StatusAtendimento>(entrada, "status");
        var responsavel = LerInteiro(entrada, "responsavel_id", obrigatorio: false);

        var agenda = await _atendimentos.GetAgendaAsync(_empresaId, inicio, fim, responsavel, historico: true, ct);
        var nomes = await NomesDaEquipeAsync(ct);
        var filtrados = agenda.Where(a => status is null || a.Status == status).ToList();

        return new
        {
            total = filtrados.Count,
            porStatus = filtrados
                .GroupBy(a => a.Status)
                .Select(g => new { status = g.Key.ToString(), quantidade = g.Count(), valor = g.Sum(a => a.ValorTotal) }),
            mostrando = Math.Min(filtrados.Count, MaxItens),
            itens = filtrados
                .OrderBy(a => a.DataAgendada ?? a.DataRegistro)
                .Take(MaxItens)
                .Select(a => new
                {
                    atendimentoId = a.Id,
                    data = Formatar(FusoBrasilia.DiaLocal(a.DataAgendada ?? a.DataRegistro)),
                    status = a.Status.ToString(),
                    clienteId = a.ClienteId,
                    cliente = a.ClienteNome,
                    responsavel = nomes.GetValueOrDefault(a.UsuarioId, "Sem nome"),
                    servico = a.Resumo,
                    valor = a.ValorTotal,
                }),
        };
    }

    private async Task<object> OrcamentosAsync(JsonElement entrada, CancellationToken ct)
    {
        var status = LerEnum<StatusOrcamento>(entrada, "status");
        var parados = LerInteiro(entrada, "parados_ha_dias", obrigatorio: false);
        if (parados is < 0) throw new FerramentaInvalidaException("parados_ha_dias não pode ser negativo.");

        var pagina = await _orcamentos.GetPaginaAsync(
            _empresaId,
            new PaginacaoQuery { Tamanho = PaginacaoQuery.TamanhoMaximo },
            new OrcamentoFiltroQuery { Status = status },
            ct);

        var hoje = Hoje();
        var itens = pagina.Itens
            .Select(o => new
            {
                orcamentoId = o.Id,
                clienteId = o.ClienteId,
                cliente = o.ClienteNome,
                status = o.Status.ToString(),
                valor = o.ValorTotal,
                criadoEm = Formatar(FusoBrasilia.DiaLocal(o.DataRegistro)),
                diasSemMudanca = hoje.DayNumber - FusoBrasilia.DiaLocal(o.UpdatedAt).DayNumber,
                convertidoEmAtendimento = o.AtendimentoConvertidoId is not null,
            })
            .Where(o => parados is null || o.diasSemMudanca >= parados)
            .OrderByDescending(o => o.diasSemMudanca)
            .ToList();

        return new
        {
            total = itens.Count,
            valorTotal = itens.Sum(o => o.valor),
            mostrando = Math.Min(itens.Count, MaxItens),
            itens = itens.Take(MaxItens),
        };
    }

    private async Task<object> MetricasAsync(JsonElement entrada, CancellationToken ct)
    {
        var (inicio, fim) = LerPeriodo(entrada);
        var d = await _metricas.GetDashboardAsync(_empresaId, inicio, fim, ct);
        var r = d.Rentabilidade;
        return new
        {
            de = Formatar(FusoBrasilia.DiaLocal(d.De)),
            ate = Formatar(FusoBrasilia.DiaLocal(d.Ate)),
            // A receita dia a dia fica de fora: num ano inteiro seria uma lista enorme.
            rentabilidade = new
            {
                r.Faturamento,
                r.CustoTotal,
                r.Margem,
                r.MargemPercentual,
                r.Atendimentos,
                r.TicketMedio,
            },
            vendas = d.Vendas,
            servicos = d.Servicos,
            estoque = d.Estoque,
        };
    }

    private async Task<object> EquipeAsync(CancellationToken ct)
    {
        var usuarios = await _usuarios.GetAllAsync(_empresaId, ct);
        return usuarios.Select(u => new
        {
            id = u.Id,
            nome = u.Nome,
            perfil = u.Perfil == PerfilUsuario.Dono ? "Dono" : "Agente de campo",
            ativo = u.Ativo,
        });
    }

    private async Task<object> DesempenhoAsync(JsonElement entrada, CancellationToken ct)
    {
        var (inicio, fim) = LerPeriodo(entrada);
        var agenda = await _atendimentos.GetAgendaAsync(_empresaId, inicio, fim, null, historico: true, ct);
        var usuarios = await _usuarios.GetAllAsync(_empresaId, ct);
        var porPessoa = agenda.ToLookup(a => a.UsuarioId);

        return usuarios
            .Select(u =>
            {
                var dele = porPessoa[u.Id].ToList();
                return new
                {
                    id = u.Id,
                    nome = u.Nome,
                    ativo = u.Ativo,
                    concluidos = dele.Count(a => a.Status == StatusAtendimento.Concluido),
                    pendentes = dele.Count(a => a.Status == StatusAtendimento.Pendente),
                    cancelados = dele.Count(a => a.Status == StatusAtendimento.Cancelado),
                    faturamento = dele.Where(a => a.Status == StatusAtendimento.Concluido).Sum(a => a.ValorTotal),
                };
            })
            .Where(p => p.ativo || p.concluidos + p.pendentes + p.cancelados > 0)
            .OrderByDescending(p => p.faturamento)
            .ToList();
    }

    private async Task<object> ClientesAsync(JsonElement entrada, CancellationToken ct)
    {
        var busca = LerTexto(entrada, "busca", 2, 100);
        var pagina = await _clientes.GetPaginaAsync(
            _empresaId, new PaginacaoQuery { Tamanho = 10 }, new ClienteFiltroQuery { Busca = busca }, ct);

        return new
        {
            total = pagina.Total,
            itens = pagina.Itens.Select(c => new
            {
                clienteId = c.Id,
                nome = c.Nome,
                totalAtendimentos = c.TotalAtendimentos,
                ultimoAtendimento = c.UltimoAtendimento is { } u ? Formatar(FusoBrasilia.DiaLocal(u)) : null,
            }),
        };
    }

    private async Task<object> HistoricoAsync(JsonElement entrada, CancellationToken ct)
    {
        var clienteId = LerInteiro(entrada, "cliente_id", obrigatorio: true)!.Value;
        var cliente = await _clientes.GetByIdAsync(_empresaId, clienteId, ct);
        var pagina = await _atendimentos.GetPaginaAsync(
            _empresaId,
            new PaginacaoQuery { Tamanho = 20 },
            new AtendimentoFiltroQuery { ClienteId = clienteId, Ordem = AtendimentoFiltroQuery.OrdemRegistro },
            ct);

        return new
        {
            clienteId = cliente.Id,
            cliente = cliente.Nome,
            totalAtendimentos = pagina.Total,
            mostrando = pagina.Itens.Count,
            itens = pagina.Itens.Select(a => new
            {
                atendimentoId = a.Id,
                data = Formatar(FusoBrasilia.DiaLocal(a.DataAgendada ?? a.DataRegistro)),
                status = a.Status.ToString(),
                servico = a.Resumo,
                valor = a.ValorTotal,
                pago = a.PagoEm is not null,
            }),
        };
    }

    private async Task<object> ProdutosAsync(JsonElement entrada, CancellationToken ct)
    {
        var busca = LerTexto(entrada, "busca", 2, 100);
        var pagina = await _produtos.GetPaginaAsync(
            _empresaId, new PaginacaoQuery { Tamanho = 10 }, new ProdutoFiltroQuery { Busca = busca }, ct);

        return new
        {
            total = pagina.Total,
            itens = pagina.Itens.Select(p => new { produtoId = p.Id, nome = p.Nome, preco = p.Preco, estoque = p.QuantidadeEstoque }),
        };
    }

    private async Task<object> WhatsAppAsync(JsonElement entrada, CancellationToken ct)
    {
        if (_acoes.Count >= MaxAcoes)
            throw new FerramentaInvalidaException($"Já há {MaxAcoes} mensagens preparadas nesta resposta.");

        var clienteId = LerInteiro(entrada, "cliente_id", obrigatorio: true)!.Value;
        var mensagem = LerTexto(entrada, "mensagem", 1, MaxMensagemWhatsApp);
        var cliente = await _clientes.GetByIdAsync(_empresaId, clienteId, ct);
        if (string.IsNullOrWhiteSpace(cliente.Telefone))
            throw new FerramentaInvalidaException($"{cliente.Nome} não tem telefone no cadastro. Diga ao dono para cadastrar em Clientes.");

        // O telefone vai para o painel montar o link; ao modelo volta só a confirmação.
        _acoes.Add(new AcaoAgenteResponse
        {
            Tipo = "whatsapp",
            ClienteId = cliente.Id,
            ClienteNome = cliente.Nome,
            Telefone = cliente.Telefone,
            Mensagem = mensagem,
        });
        return $"Mensagem para {cliente.Nome} preparada. O painel mostra o botão para o dono revisar e enviar; não repita o texto inteiro na resposta.";
    }

    private async Task<Dictionary<long, string>> NomesDaEquipeAsync(CancellationToken ct) =>
        (await _usuarios.GetAllAsync(_empresaId, ct)).ToDictionary(u => u.Id, u => u.Nome);

    // ---------- entrada ----------

    private static (DateTime Inicio, DateTime Fim) LerPeriodo(JsonElement entrada)
    {
        var de = LerDia(entrada, "de");
        var ate = LerDia(entrada, "ate");
        if (ate < de) throw new FerramentaInvalidaException("\"ate\" vem antes de \"de\".");
        // Dias de Brasília: do início de "de" ao último instante de "ate", em UTC.
        var inicio = TimeZoneInfo.ConvertTimeToUtc(de.ToDateTime(TimeOnly.MinValue), FusoBrasilia.Info);
        var fim = TimeZoneInfo.ConvertTimeToUtc(ate.AddDays(1).ToDateTime(TimeOnly.MinValue), FusoBrasilia.Info).AddTicks(-1);
        return (inicio, fim);
    }

    private static DateOnly LerDia(JsonElement entrada, string campo)
    {
        var texto = Propriedade(entrada, campo) is { ValueKind: JsonValueKind.String } v ? v.GetString() : null;
        if (texto is null || !DateOnly.TryParseExact(texto, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dia))
            throw new FerramentaInvalidaException($"\"{campo}\" deve ser uma data no formato AAAA-MM-DD.");
        return dia;
    }

    private static long? LerInteiro(JsonElement entrada, string campo, bool obrigatorio)
    {
        var v = Propriedade(entrada, campo);
        if (v is null or { ValueKind: JsonValueKind.Null })
            return obrigatorio ? throw new FerramentaInvalidaException($"\"{campo}\" é obrigatório.") : null;
        if (v.Value.ValueKind == JsonValueKind.Number && v.Value.TryGetInt64(out var n)) return n;
        if (v.Value.ValueKind == JsonValueKind.String && long.TryParse(v.Value.GetString(), out n)) return n;
        throw new FerramentaInvalidaException($"\"{campo}\" deve ser um número inteiro.");
    }

    private static string LerTexto(JsonElement entrada, string campo, int minimo, int maximo)
    {
        var texto = (Propriedade(entrada, campo) is { ValueKind: JsonValueKind.String } v ? v.GetString() : null)?.Trim();
        if (string.IsNullOrEmpty(texto) || texto.Length < minimo)
            throw new FerramentaInvalidaException($"\"{campo}\" deve ter pelo menos {minimo} caractere(s).");
        if (texto.Length > maximo)
            throw new FerramentaInvalidaException($"\"{campo}\" deve ter no máximo {maximo} caracteres.");
        return texto;
    }

    private static T? LerEnum<T>(JsonElement entrada, string campo) where T : struct, Enum
    {
        var v = Propriedade(entrada, campo);
        if (v is null or { ValueKind: JsonValueKind.Null }) return null;
        if (v.Value.ValueKind == JsonValueKind.String
            && Enum.TryParse<T>(v.Value.GetString(), ignoreCase: true, out var valor)
            && Enum.IsDefined(valor))
            return valor;
        throw new FerramentaInvalidaException($"\"{campo}\" deve ser um destes: {string.Join(", ", Enum.GetNames<T>())}.");
    }

    private static JsonElement? Propriedade(JsonElement entrada, string campo) =>
        entrada.ValueKind == JsonValueKind.Object && entrada.TryGetProperty(campo, out var v) ? v : null;

    private static DateOnly Hoje() => FusoBrasilia.DiaLocal(DateTime.UtcNow);

    private static string Formatar(DateOnly dia) => dia.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    // ---------- esquema ----------

    private static Dictionary<string, JsonElement> Props(params (string Nome, JsonElement Esquema)[] campos) =>
        campos.ToDictionary(c => c.Nome, c => c.Esquema);

    private static JsonElement Data(string descricao) =>
        JsonSerializer.SerializeToElement(new { type = "string", description = $"{descricao}, no formato AAAA-MM-DD" });

    private static JsonElement Texto(string descricao) =>
        JsonSerializer.SerializeToElement(new { type = "string", description = descricao });

    private static JsonElement Inteiro(string descricao) =>
        JsonSerializer.SerializeToElement(new { type = "integer", description = descricao });

    private static JsonElement Opcoes(params string[] valores) =>
        JsonSerializer.SerializeToElement(new { type = "string", @enum = valores });
}
