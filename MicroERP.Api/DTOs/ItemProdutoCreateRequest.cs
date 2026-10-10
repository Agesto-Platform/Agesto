using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ItemProdutoCreateRequest
{
    [Required(ErrorMessage = "Atendimento obrigatorio.")]
    [Range(1, long.MaxValue, ErrorMessage = "Atendimento invalido.")]
    public long AtendimentoId { get; set; }

    // Opcional: quando informado, item de catalogo (baixa estoque).
    // Quando nulo, item avulso (nao baixa estoque, exige Descricao).
    [Range(1, long.MaxValue, ErrorMessage = "Produto invalido.")]
    public long? ProdutoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string? Descricao { get; set; }

    // Valor unitario cobrado do cliente. Opcional: se nulo e houver ProdutoId,
    // usa o preco do catalogo como default (DEC-23).
    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal? PrecoUnitario { get; set; }

    // Custo que o prestador pagou por esta linha (livre, sem regra — DEC-19).
    [Range(0, 999999.99, ErrorMessage = "Custo invalido.")]
    public decimal? Custo { get; set; }

    [Range(1, 9999, ErrorMessage = "Quantidade invalida.")]
    public int Quantidade { get; set; }
}
