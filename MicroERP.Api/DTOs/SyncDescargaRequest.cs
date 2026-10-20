using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class SyncDescargaRequest
{
    // Limites por leva: o device envia em lotes; payload maior é abuso.
    [MaxLength(500, ErrorMessage = "Máximo de 500 clientes por sincronização.")]
    public IReadOnlyList<ClienteCreateRequest> Clientes { get; set; } = [];
    [MaxLength(100, ErrorMessage = "Máximo de 100 serviços por sincronização.")]
    public IReadOnlyList<ServicoSyncRequest> Servicos { get; set; } = [];
    [MaxLength(500, ErrorMessage = "Máximo de 500 atendimentos por sincronização.")]
    public IReadOnlyList<AtendimentoSyncRequest> Atendimentos { get; set; } = [];
    // Atendimentos do servidor concluidos no app (ex.: visita agendada pelo Dono).
    [MaxLength(500, ErrorMessage = "Máximo de 500 conclusões por sincronização.")]
    public IReadOnlyList<AtendimentoConclusaoSyncRequest> Conclusoes { get; set; } = [];
}