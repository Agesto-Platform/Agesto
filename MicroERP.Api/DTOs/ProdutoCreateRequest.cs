using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ProdutoCreateRequest
{
    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no máximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Range(0.01, 999999999999.99, ErrorMessage = "Preço inválido.")]
    public decimal Preco { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Quantidade em estoque inválida.")]
    public int QuantidadeEstoque { get; set; }
}
