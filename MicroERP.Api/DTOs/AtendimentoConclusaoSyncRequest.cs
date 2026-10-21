using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Atendimento que ja existe no servidor (agendado pelo Dono, por exemplo) e foi
// concluido no app: novo status e itens acrescentados. Os itens ja gravados nao mudam.
public sealed class AtendimentoConclusaoSyncRequest
{
    // Uuid do atendimento no servidor.
    public Guid Uuid { get; set; }
    public StatusAtendimento Status { get; set; }
    [MaxLength(100, ErrorMessage = "Máximo de 100 produtos por atendimento.")]
    public IReadOnlyList<ItemProdutoSyncRequest> ItensProduto { get; set; } = [];
    [MaxLength(100, ErrorMessage = "Máximo de 100 serviços por atendimento.")]
    public IReadOnlyList<ItemServicoSyncRequest> ItensServico { get; set; } = [];
}
