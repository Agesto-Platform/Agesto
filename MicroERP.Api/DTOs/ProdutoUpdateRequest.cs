using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ProdutoUpdateRequest
{
    [Required(ErrorMessage = "Nome obrigatorio.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no minimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no maximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [Range(0.01, 999999.99, ErrorMessage = "Preco invalido.")]
    public decimal Preco { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Quantidade em estoque invalida.")]
    public int QuantidadeEstoque { get; set; }
}
