using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class SyncDescargaRequest
{
    // Limites por leva: o device envia em lotes; payload maior é abuso.
    [MaxLength(500, ErrorMessage = "Maximo de 500 clientes por sincronizacao.")]
    public IReadOnlyList<ClienteCreateRequest> Clientes { get; set; } = [];
    [MaxLength(100, ErrorMessage = "Maximo de 100 servicos por sincronizacao.")]
    public IReadOnlyList<ServicoSyncRequest> Servicos { get; set; } = [];
    [MaxLength(500, ErrorMessage = "Maximo de 500 atendimentos por sincronizacao.")]
    public IReadOnlyList<AtendimentoSyncRequest> Atendimentos { get; set; } = [];
}