using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemServicoSyncRequest
{
    // Gerado no device. Obrigatorio ao concluir atendimento existente, para o
    // reenvio nao duplicar o item; opcional no atendimento novo.
    public Guid? Uuid { get; set; }
    // Serviço do catálogo (id do servidor) ou criado offline (uuid do device,
    // resolvido no servidor). Informe um dos dois; o uuid tem precedencia.
    public long? ServicoId { get; set; }
    public Guid? ServicoUuid { get; set; }
    // Valor ajustado no atendimento (DEC-23); nulo cobra o valor do catalogo.
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }
    public int Quantidade { get; set; }
}
