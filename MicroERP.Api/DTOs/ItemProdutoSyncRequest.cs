using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoSyncRequest
{
    // Gerado no device. Obrigatorio ao concluir atendimento existente, para o
    // reenvio nao duplicar o item; opcional no atendimento novo.
    public Guid? Uuid { get; set; }

    // Produto do catalogo (baixa estoque). Nulo = item avulso: exige Descricao e
    // PrecoUnitario e nao movimenta estoque, como no web.
    public long? ProdutoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Obrigatorio no item avulso. No item de catalogo, ajusta o valor no
    // atendimento (DEC-23); nulo cobra o preco do produto.
    [Range(0, 999999.99, ErrorMessage = "Valor unitário inválido.")]
    public decimal? PrecoUnitario { get; set; }

    public int Quantidade { get; set; }
}
