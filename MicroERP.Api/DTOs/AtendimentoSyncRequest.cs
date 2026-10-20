using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoSyncRequest
{
    public Guid Uuid { get; set; }
    public DateTime DataRegistro { get; set; }
    public DateTime? DataAgendada { get; set; }
    public StatusAtendimento Status { get; set; }
    // Cliente ja sincronizado (id do servidor) ou criado offline (uuid do device,
    // resolvido no servidor). Informe um dos dois; o uuid tem precedencia.
    public long? ClienteId { get; set; }
    public Guid? ClienteUuid { get; set; }
    [MaxLength(100, ErrorMessage = "Maximo de 100 produtos por atendimento.")]
    public IReadOnlyList<ItemProdutoSyncRequest> ItensProduto { get; set; } = [];
    [MaxLength(100, ErrorMessage = "Maximo de 100 servicos por atendimento.")]
    public IReadOnlyList<ItemServicoSyncRequest> ItensServico { get; set; } = [];
}