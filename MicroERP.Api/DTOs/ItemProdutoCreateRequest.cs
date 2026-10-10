using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoCreateRequest
{
    [Required(ErrorMessage = "Atendimento obrigatório.")]
    [Range(1, long.MaxValue, ErrorMessage = "Atendimento inválido.")]
    public long AtendimentoId { get; set; }

    // Opcional: quando informado, item de catalogo (baixa estoque).
    // Quando nulo, item avulso (nao baixa estoque, exige Descricao).
    [Range(1, long.MaxValue, ErrorMessage = "Produto inválido.")]
    public long? ProdutoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Valor unitario cobrado do cliente. Opcional: se nulo e houver ProdutoId,
    // usa o preco do catalogo como default (DEC-23).
    [Range(0, double.MaxValue, ErrorMessage = "Valor unitário inválido.")]
    public decimal? PrecoUnitario { get; set; }

    // Custo que o prestador pagou por esta linha (livre, sem regra — DEC-19).
    [Range(0, double.MaxValue, ErrorMessage = "Custo inválido.")]
    public decimal? Custo { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Quantidade inválida.")]
    public int Quantidade { get; set; }
}
