using MicroERP.Api.DTOs;

namespace MicroERP.Api.DTOs;

public sealed class SyncCargaResponse
{
    public IReadOnlyList<ClienteResponse> Clientes { get; set; } = [];
    public IReadOnlyList<ProdutoResponse> Produtos { get; set; } = [];
    public IReadOnlyList<ServicoResponse> Servicos { get; set; } = [];
    public IReadOnlyList<OrcamentoResponse> Orcamentos { get; set; } = [];
    public IReadOnlyList<SyncSugeridoResponse> Sugeridos { get; set; } = [];
    public ConfiguracaoResponse? Configuracao { get; set; }
    // Agenda do mês, a mesma de GET /api/atendimento/agenda (o Agente só a própria).
    // Vem inteira nas duas Cargas, para o app não fazer uma segunda chamada.
    public IReadOnlyList<AgendaItemResponse> Agenda { get; set; } = [];
    // PERF-01: na Carga incremental (com ultimaSincronizacao), ids excluídos desde
    // então, para o app apagar do SQLite. Nulo na Carga completa.
    public SyncRemovidosResponse? Removidos { get; set; }
    public DateTime SincronizadoEm { get; set; }
}

public sealed class SyncRemovidosResponse
{
    public IReadOnlyList<long> Clientes { get; set; } = [];
    public IReadOnlyList<long> Produtos { get; set; } = [];
    public IReadOnlyList<long> Servicos { get; set; } = [];
}